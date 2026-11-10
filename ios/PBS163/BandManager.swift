import Foundation
import CoreBluetooth

@MainActor
final class BandManager: NSObject, ObservableObject {
    @Published var status = "Bağlı değil"
    @Published var connected = false
    @Published var battery: Int?
    @Published var todaySteps = 0
    @Published var todayDistance = 0
    @Published var todayCalories = 0
    @Published var logs: [String] = []
    @Published var lastSync: Date?

    var onDecoded: ((Decoded) -> Void)?

    private var central: CBCentralManager!
    private var band: CBPeripheral?
    private var rxChar: CBCharacteristic?
    private var txChar: CBCharacteristic?
    private var batteryChar: CBCharacteristic?
    private var rxBuf = Data()
    private var handshaken = false
    private var shouldReconnect = true

    private let idKey = "pbs163.peripheral"
    private let userKey = "pbs163.userid"
    private let stepKey = "pbs163.stepTotal"
    private let stepDayKey = "pbs163.stepDay"

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: .main)
    }

    func start() {
        shouldReconnect = true
        guard central.state == .poweredOn else { return }
        if let s = UserDefaults.standard.string(forKey: idKey), let uuid = UUID(uuidString: s) {
            let known = central.retrievePeripherals(withIdentifiers: [uuid])
            if let p = known.first { connect(p); return }
        }
        scan()
    }

    func stop() {
        shouldReconnect = false
        if let b = band { central.cancelPeripheralConnection(b) }
        status = "Bağlı değil"
        connected = false
    }

    private func scan() {
        status = "Saat aranıyor…"
        central.scanForPeripherals(withServices: nil, options: nil)
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
            guard let self, self.band == nil else { return }
            self.status = "Saat bulunamadı. Ekranına dokun ve tekrar dene."
            self.central.stopScan()
        }
    }

    private func connect(_ p: CBPeripheral) {
        central.stopScan()
        band = p
        p.delegate = self
        status = "Bağlanıyor…"
        central.connect(p, options: nil)
    }

    private var userId: String {
        if let s = UserDefaults.standard.string(forKey: userKey) { return s }
        let s = UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(8).lowercased()
        UserDefaults.standard.set(String(s), forKey: userKey)
        return String(s)
    }

    private func handshake() {
        guard let p = band, let rx = rxChar, !handshaken else { return }
        handshaken = true
        status = "Senkronize ediliyor…"
        send(PBS.packet(0x02, 0x01, PBS.timePayload()), p, rx)
        after(0.4) { self.send(PBS.packet(0xF3, 0x00), p, rx) }
        after(0.9) { self.send(PBS.packet(0x03, 0x00, Array(self.userId.utf8)), p, rx) }
        after(1.4) { self.send(PBS.packet(0x05, 0x01), p, rx) }   // history
        after(2.0) { self.send(PBS.packet(0x05, 0x06, [0x01]), p, rx) } // realtime steps
        after(2.6) {
            if let b = self.batteryChar { p.readValue(for: b) }
        }
        after(3.0) { self.status = "Bağlı" }
    }

    func syncNow() {
        guard let p = band, let rx = rxChar else { start(); return }
        send(PBS.packet(0x02, 0x01, PBS.timePayload()), p, rx)
        after(0.3) { self.send(PBS.packet(0x05, 0x01), p, rx) }
        after(0.6) { self.send(PBS.packet(0x05, 0x06, [0x01]), p, rx) }
        after(1.2) { if let b = self.batteryChar { p.readValue(for: b) } }
    }

    private func after(_ s: Double, _ block: @escaping () -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + s, execute: block)
    }

    private func send(_ d: Data, _ p: CBPeripheral, _ ch: CBCharacteristic) {
        let type: CBCharacteristicWriteType = ch.properties.contains(.write) ? .withResponse : .withoutResponse
        p.writeValue(d, for: ch, type: type)
    }

    private func log(_ s: String) {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        logs.append("\(f.string(from: Date()))  \(s)")
        if logs.count > 200 { logs.removeFirst(logs.count - 200) }
    }

    // MARK: frame stream

    private func feed(_ d: Data) {
        if rxBuf.isEmpty {
            guard let first = d.first else { return }
            if first == 0xDF, d.count >= 3 {
                let total = (Int(d[1]) << 8 | Int(d[2])) + 4
                if d.count >= total { complete(d.prefix(total)); feed(Data(d.dropFirst(total))); return }
                rxBuf = d
            }
            return
        }
        rxBuf.append(d)
        guard rxBuf.count >= 3 else { return }
        let total = (Int(rxBuf[1]) << 8 | Int(rxBuf[2])) + 4
        if rxBuf.count >= total {
            let frame = rxBuf.prefix(total)
            rxBuf = Data(rxBuf.dropFirst(total))
            complete(frame)
            if !rxBuf.isEmpty { let rest = rxBuf; rxBuf = Data(); feed(rest) }
        }
    }

    private func complete(_ frame: Data) {
        let b = [UInt8](frame)
        guard b.count >= 9, b[0] == 0xDF else { return }
        var sum: UInt16 = 0
        for (i, x) in b.enumerated() where i != 3 { sum = (sum &+ UInt16(x)) & 0xFF }
        guard UInt8(sum) == b[3] else { log("bozuk frame"); return }
        let cat = b[4], key = b[6]
        if let p = band, let rx = rxChar { send(PBS.ack(cat, key), p, rx) }

        let payload = Array(b[9...])
        guard let decoded = Decoder.decode(category: cat, key: key, payload: payload) else { return }

        if let t = decoded.totals {
            todaySteps = t.steps
            todayDistance = t.distance
            todayCalories = t.calories
            lastSync = Date()
        }
        onDecoded?(decoded)
    }
}

extension BandManager: CBCentralManagerDelegate {
    nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        Task { @MainActor in
            switch central.state {
            case .poweredOn: start()
            case .unauthorized: status = "Bluetooth izni yok"
            case .poweredOff: status = "Bluetooth kapalı"
            default: break
            }
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                                    advertisementData: [String: Any], rssi RSSI: NSNumber) {
        Task { @MainActor in
            let name = (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? peripheral.name ?? ""
            if name.uppercased().contains("PBS163") || peripheral.name?.uppercased().contains("PBS163") == true {
                UserDefaults.standard.set(peripheral.identifier.uuidString, forKey: idKey)
                connect(peripheral)
            }
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        Task { @MainActor in
            connected = true
            handshaken = false
            status = "Bağlandı"
            log("bağlandı: \(peripheral.identifier.uuidString)")
            peripheral.discoverServices([
                CBUUID(string: PBS.service),
                CBUUID(string: PBS.batteryService),
                CBUUID(string: PBS.deviceInfo),
            ])
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        Task { @MainActor in
            connected = false
            handshaken = false
            rxChar = nil; txChar = nil; batteryChar = nil
            status = "Bağlantı koptu"
            log("disconnect: \(error?.localizedDescription ?? "-")")
            if shouldReconnect { after(4) { self.start() } }
        }
    }
}

extension BandManager: CBPeripheralDelegate {
    nonisolated func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        Task { @MainActor in
            for s in peripheral.services ?? [] {
                peripheral.discoverCharacteristics(nil, for: s)
            }
        }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        Task { @MainActor in
            for ch in service.characteristics ?? [] {
                switch ch.uuid.uuidString.uppercased() {
                case PBS.rx.uppercased(): rxChar = ch
                case PBS.tx.uppercased():
                    txChar = ch
                    peripheral.setNotifyValue(true, for: ch)
                case PBS.batteryLevel.uppercased(): batteryChar = ch
                default: break
                }
            }
            if rxChar != nil, txChar != nil, !handshaken {
                handshake()
            }
        }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        Task { @MainActor in
            if characteristic.uuid.uuidString.uppercased() == PBS.tx.uppercased() {
                log("bildirim kanalı açık")
            }
        }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        Task { @MainActor in
            guard let v = characteristic.value else { return }
            if characteristic.uuid.uuidString.uppercased() == PBS.batteryLevel.uppercased() {
                if let b = v.first { battery = Int(b) }
                return
            }
            if characteristic.uuid.uuidString.uppercased() == PBS.firmware.uppercased() { return }
            if characteristic.uuid.uuidString.uppercased() == PBS.tx.uppercased() { feed(v) }
        }
    }
}
