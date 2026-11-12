import { BleManager, Device } from "react-native-ble-plx";
import { Buffer } from "buffer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SERVICE, RX, TX, FrameAssembler, packet, ack, timePayload, decode, Decoded,
} from "./protocol";

type Status = (text: string, connected: boolean) => void;
type Data = (d: Decoded) => void;

const USER_ID = "pbs163rn";
const BATTERY_SERVICE = "180F";
const BATTERY_LEVEL = "2A19";

export class BandClient {
  manager = new BleManager();
  device?: Device;
  private assembler = new FrameAssembler();
  private connected = false;
  private listening = false;
  private scanning = false;

  onStatus?: Status;
  onData?: Data;
  onBattery?: (level: number) => void;

  start() {
    if (!this.listening) {
      this.listening = true;
      this.manager.onStateChange((state) => {
        if (state === "PoweredOn") this.begin();
        else if (state === "Unauthorized") this.onStatus?.("Bluetooth izni yok", false);
        else if (state === "PoweredOff") this.onStatus?.("Bluetooth kapalı", false);
      }, true);
      return;
    }
    this.begin();
  }

  private begin() {
    if (this.connected || this.scanning) return;
    this.connectKnown().then((ok) => {
      if (!ok) this.scan();
    });
  }

  private async connectKnown(): Promise<boolean> {
    try {
      const id = await AsyncStorage.getItem("ble.deviceId");
      if (!id) return false;
      this.onStatus?.("Bağlanıyor…", false);
      const d = await this.manager.connectToDevice(id, { timeout: 8000 });
      await this.attach(d);
      return true;
    } catch {
      return false;
    }
  }

  private scan() {
    if (this.connected || this.scanning) return;
    this.scanning = true;
    this.onStatus?.("Saat aranıyor…", false);
    this.manager.startDeviceScan(null, null, async (error, dev) => {
      if (error) {
        this.scanning = false;
        this.onStatus?.(`Tarama hatası: ${error.message}`, false);
        return;
      }
      if (!dev) return;
      const name = (dev.localName || dev.name || "").toUpperCase();
      if (name.includes("PBS163")) {
        this.manager.stopDeviceScan();
        this.scanning = false;
        try {
          await this.connect(dev);
        } catch (e: any) {
          this.onStatus?.(`Bağlantı hatası: ${e.message}`, false);
        }
      }
    });
    setTimeout(() => {
      if (!this.connected && this.scanning) {
        this.scanning = false;
        this.manager.stopDeviceScan();
        this.onStatus?.("Saat bulunamadı. Ekranına dokun ve tekrar dene.", false);
      }
    }, 20000);
  }

  private async connect(dev: Device) {
    this.onStatus?.("Bağlanıyor…", false);
    let d = dev;
    try {
      if (await d.isConnected()) {
        await d.cancelConnection();
        await this.sleep(300);
      }
      d = await d.connect();
    } catch (e: any) {
      if (String(e?.message ?? "").toLowerCase().includes("already")) {
        try {
          await dev.cancelConnection();
          await this.sleep(500);
        } catch {}
        d = await dev.connect();
      } else {
        throw e;
      }
    }
    await this.attach(d);
  }

  private async attach(d: Device) {
    await d.discoverAllServicesAndCharacteristics();
    this.device = d;
    this.connected = true;
    this.scanning = false;
    AsyncStorage.setItem("ble.deviceId", d.id).catch(() => {});
    this.onStatus?.("Bağlandı", true);

    try {
      await d.requestMTU(512);
    } catch {}

    d.onDisconnected(() => {
      this.connected = false;
      this.device = undefined;
      this.onStatus?.("Bağlantı koptu", false);
    });

    d.monitorCharacteristicForService(SERVICE, TX, (err, ch) => {
      if (err || !ch?.value) return;
      const bytes = new Uint8Array(Buffer.from(ch.value, "base64"));
      for (const f of this.assembler.push(bytes)) {
        this.write(ack(f.cat, f.key)).catch(() => {});
        const decoded = decode(f);
        if (decoded) this.onData?.(decoded);
      }
    });

    this.readBattery();
    await this.handshake();
  }

  private async handshake() {
    this.onStatus?.("Senkronize ediliyor…", true);
    this.buzz(400);
    this.readBattery();
    await this.write(packet(0x02, 0x01, timePayload()));
    await this.sleep(300);
    await this.write(packet(0xf3, 0x00));
    await this.sleep(400);
    await this.write(packet(0x03, 0x00, Array.from(Buffer.from(USER_ID))));
    await this.sleep(400);
    // Vendor order: realtime switch first, then history, then today's history.
    await this.write(packet(0x05, 0x06, [0x01]));
    await this.sleep(400);
    await this.write(packet(0x05, 0x01)); // all history
    await this.sleep(400);
    await this.write(packet(0x05, 0x0a)); // today
    this.buzz(300);
    this.onStatus?.("Bağlı", true);
  }

  async syncNow() {
    if (!this.device) {
      this.scan();
      return;
    }
    this.onStatus?.("Senkronize ediliyor…", true);
    this.buzz(400);
    this.readBattery();
    await this.write(packet(0x02, 0x01, timePayload()));
    await this.sleep(200);
    await this.write(packet(0x05, 0x01));
    await this.sleep(400);
    await this.write(packet(0x05, 0x06, [0x01]));
    setTimeout(() => {
      this.buzz(400);
      this.onStatus?.("Bağlı", true);
    }, 1200);
  }

  cancel() {
    this.manager.stopDeviceScan();
    if (this.device) this.device.cancelConnection().catch(() => {});
    this.device = undefined;
    this.connected = false;
    this.onStatus?.("Bağlı değil", false);
  }

  async disconnect() {
    if (this.device) await this.device.cancelConnection();
    this.connected = false;
    this.device = undefined;
    this.onStatus?.("Bağlı değil", false);
  }

  private async readBattery() {
    try {
      const ch = await this.device?.readCharacteristicForService(BATTERY_SERVICE, BATTERY_LEVEL);
      if (ch?.value) {
        const b = Buffer.from(ch.value, "base64");
        if (b.length > 0) this.onBattery?.(b[0]);
      }
    } catch {}
  }

  private async write(base64: string) {
    const d = this.device;
    if (!d) return;
    await d.writeCharacteristicWithResponseForService(SERVICE, RX, base64);
  }

  private async buzz(ms = 450) {
    try {
      await this.write(packet(0x02, 0x0b, [0x01]));
      await this.sleep(ms);
      await this.write(packet(0x02, 0x0b, [0x00]));
    } catch {}
  }

  private sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(() => r(), ms));
  }
}
