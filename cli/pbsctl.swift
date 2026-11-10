import Foundation
import CoreBluetooth

// PBS163 / HryFine BLE CLI for macOS — protocol from jsphu/polosmart-pbs163-ble (MIT)
// usage: pbsctl <time|buzz|battery|msg|call|hr|spo2|weather|24h|metric|raw> [args]

func packet(_ category: UInt8, _ sub: UInt8, _ payload: [UInt8] = []) -> Data {
    let v2 = payload.count + 5
    var raw: [UInt8] = [
        0xDF, UInt8((v2 >> 8) & 0xFF), UInt8(v2 & 0xFF),
        category, 0x01, sub,
        UInt8((payload.count >> 8) & 0xFF), UInt8(payload.count & 0xFF),
    ] + payload
    let ck = raw.reduce(0) { ($0 &+ UInt16($1)) & 0xFF }
    raw.insert(UInt8(ck), at: 3)
    return Data(raw)
}

func timePayload(_ d: Date = Date()) -> [UInt8] {
    let c = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: d)
    let y = UInt8(((c.year ?? 2026) - 2000) & 0xFF)
    let m = UInt8((c.month ?? 1) & 0xFF)
    let day = UInt8((c.day ?? 1) & 0xFF)
    let h = UInt8((c.hour ?? 0) & 0xFF)
    let mi = UInt8((c.minute ?? 0) & 0xFF)
    let s = UInt8((c.second ?? 0) & 0xFF)
    return [
        ((y << 2) & 0xFF) | ((m >> 2) & 0xFF),
        (((m & 3) << 6) & 0xFF) | ((day << 1) & 0xFF) | ((h >> 4) & 0xFF),
        (((h & 15) << 4) & 0xFF) | ((mi >> 2) & 0xFF),
        (((mi & 3) << 6) & 0xFF) | (s & 0xFF),
    ]
}

func hex(_ d: Data) -> String { d.map { String(format: "%02X", $0) }.joined(separator: " ") }

let args = CommandLine.arguments.dropFirst()
let cmd = args.first ?? "time"
let rest = Array(args.dropFirst())

final class CLI: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    let knownID = UUID(uuidString: "30531D20-4FE0-116E-2282-A6526F6399AB")!
    let nus = CBUUID(string: "6E400001-B5A3-F393-E0A9-E50E24DCCA9F")
    let rx  = CBUUID(string: "6E400002-B5A3-F393-E0A9-E50E24DCCA9F")
    let tx  = CBUUID(string: "6E400003-B5A3-F393-E0A9-E50E24DCCA9F")
    let battSvc = CBUUID(string: "180F")
    let battChr = CBUUID(string: "2A19")

    var manager: CBCentralManager?
    var p: CBPeripheral?
    var rxChar: CBCharacteristic?
    var txChar: CBCharacteristic?
    var started = false

    func centralManagerDidUpdateState(_ c: CBCentralManager) {
        guard c.state == .poweredOn else { print("Bluetooth kapalı"); exit(2) }
        if let known = c.retrievePeripherals(withIdentifiers: [knownID]).first {
            start(known)
        } else {
            print("PBS163 önbellekte yok, 20s tarama...")
            c.scanForPeripherals(withServices: [nus], options: nil)
            DispatchQueue.main.asyncAfter(deadline: .now() + 20) {
                if self.p == nil { print("bulunamadı"); exit(1) }
            }
        }
    }

    func start(_ d: CBPeripheral) {
        p = d; d.delegate = self
        manager?.connect(d, options: nil)
    }

    func centralManager(_ c: CBCentralManager, didDiscover d: CBPeripheral,
                        advertisementData: [String: Any], rssi: NSNumber) {
        if p == nil { c.stopScan(); start(d) }
    }

    func centralManager(_ c: CBCentralManager, didConnect d: CBPeripheral) {
        d.discoverServices([nus, battSvc])
    }

    func centralManager(_ c: CBCentralManager, didFailToConnect d: CBPeripheral, error: Error?) {
        print("bağlanamadı: \(error?.localizedDescription ?? "?")"); exit(1)
    }

    func peripheral(_ d: CBPeripheral, didDiscoverServices error: Error?) {
        for s in d.services ?? [] { d.discoverCharacteristics(nil, for: s) }
    }

    func peripheral(_ d: CBPeripheral, didDiscoverCharacteristicsFor s: CBService, error: Error?) {
        for ch in s.characteristics ?? [] {
            if ch.uuid == rx { rxChar = ch }
            if ch.uuid == tx { txChar = ch }
        }
        guard !started, rxChar != nil, txChar != nil else { return }
        started = true
        d.setNotifyValue(true, for: txChar!)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { self.execute() }
    }

    func peripheral(_ d: CBPeripheral, didUpdateValueFor ch: CBCharacteristic, error: Error?) {
        guard let v = ch.value else { return }
        if ch.uuid == battChr, let b = v.first {
            print("batarya: %\(b)")
        } else {
            print("<< \(hex(v))")
        }
    }

    func write(_ data: Data) {
        guard let d = p, let ch = rxChar else { return }
        print(">> \(hex(data))")
        d.writeValue(data, for: ch,
                     type: ch.properties.contains(.write) ? .withResponse : .withoutResponse)
    }

    func execute() {
        switch cmd {
        case "time":
            write(packet(0x02, 0x01, timePayload()))
        case "buzz":
            let secs = Double(rest.first ?? "1.5") ?? 1.5
            var t = 0.0
            while t < secs {
                let delay = t
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { self.write(packet(0x02, 0x0B, [0x01])) }
                t += 0.85
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + t) { self.write(packet(0x02, 0x0B, [0x00])) }
        case "battery":
            if let ch = p?.services?.flatMap({ $0.characteristics ?? [] }).first(where: { $0.uuid == battChr }) {
                p?.readValue(for: ch)
            } else { print("batarya karakteristiği yok") }
        case "msg":
            let text = rest.joined(separator: " ")
            let type = 1
            write(packet(0x02, 0x0C, [UInt8](repeating: 1, count: 12)))
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                let payload = [UInt8(type), 0, 0] + Array(text.utf8.prefix(196))
                self.write(packet(0x02, 0x12, payload))
            }
        case "call":
            let name = rest.joined(separator: " ")
            write(packet(0x02, 0x11, [1, 0] + Array(name.utf8.prefix(64))))
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) { self.write(packet(0x02, 0x11, [0, 0])) }
        case "hr":
            write(packet(0x02, 0x0D, [rest.first == "off" ? 0 : 1]))
        case "spo2":
            write(packet(0x02, 0x1C, [rest.first == "off" ? 0 : 1]))
        case "weather":
            var code: UInt8 = 1, tmin: UInt8 = 15, tmax: UInt8 = 25, cur: UInt8 = 20
            if rest.count >= 4 { code = UInt8(rest[0]) ?? 1; tmin = UInt8(rest[1]) ?? 15; tmax = UInt8(rest[2]) ?? 25; cur = UInt8(rest[3]) ?? 20 }
            let city = rest.count > 4 ? rest.dropFirst(4).joined(separator: " ") : ""
            let c = Calendar.current.dateComponents([.year, .month, .day], from: Date())
            let y = c.year ?? 2026
            let payload: [UInt8] = [UInt8((y >> 8) & 0xFF), UInt8(y & 0xFF), UInt8(c.month ?? 1), UInt8(c.day ?? 1), 0, code, tmin, tmax, cur] + Array(city.utf8.prefix(50))
            write(packet(0x02, 0x1D, payload))
        case "24h":
            write(packet(0x02, 0x1A, [rest.first == "off" ? 0 : 1]))
        case "metric":
            write(packet(0x02, 0x1B, [rest.first == "off" ? 0 : 1]))
        default:
            print("bilinmeyen komut: \(cmd)")
            print("time|buzz [sn]|battery|msg <metin>|call <isim>|hr on/off|spo2 on/off|weather <kod> <min> <max> <cur> <sehir>|24h on/off|metric on/off")
            exit(2)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.5) {
            print("done")
            if let d = self.p { self.manager?.cancelPeripheralConnection(d) }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { exit(0) }
        }
    }
}

let cli = CLI()
cli.manager = CBCentralManager(delegate: cli, queue: nil)
RunLoop.main.run(until: Date().addingTimeInterval(40))
print("timeout"); exit(1)
