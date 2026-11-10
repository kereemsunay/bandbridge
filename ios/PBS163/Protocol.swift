import Foundation

// PBS163 / HryFine protocol. Frame and field layouts reverse-engineered from
// com.lianhezhuli.hyfit (see ~/pbs163/NOTES.md).

enum PBS {
    static let service = "6E400001-B5A3-F393-E0A9-E50E24DCCA9F"
    static let rx = "6E400002-B5A3-F393-E0A9-E50E24DCCA9F"
    static let tx = "6E400003-B5A3-F393-E0A9-E50E24DCCA9F"
    static let batteryService = "180F"
    static let batteryLevel = "2A19"
    static let deviceInfo = "180A"
    static let firmware = "2A27"

    static func packet(_ category: UInt8, _ sub: UInt8, _ payload: [UInt8] = []) -> Data {
        let len = payload.count + 5
        var raw: [UInt8] = [
            0xDF, UInt8((len >> 8) & 0xFF), UInt8(len & 0xFF),
            category, 0x01, sub,
            UInt8((payload.count >> 8) & 0xFF), UInt8(payload.count & 0xFF),
        ] + payload
        let sum = raw.reduce(0) { ($0 &+ UInt16($1)) & 0xFF }
        raw.insert(UInt8(sum), at: 3)
        return Data(raw)
    }

    static func ack(_ category: UInt8, _ key: UInt8) -> Data {
        var f: [UInt8] = [0xFD, 0x00, 0x05, 0x00, category, key, 0x00, 0x01]
        f[3] = UInt8(f.reduce(0) { ($0 &+ UInt16($1)) & 0xFF })
        return Data(f)
    }

    static func timePayload(_ d: Date = Date()) -> [UInt8] {
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
}

struct StepBucket {
    let date: DateComponents
    let start: Date
    let steps: Int
    let distance: Int
    let calories: Int
}

struct HeartSample {
    let date: DateComponents
    let timestamp: Date
    let bpm: Int
}

struct SleepSummary {
    let date: DateComponents
    let start: Date
    let end: Date
    let light: Int
    let deep: Int
    let awake: Int
}

struct Totals {
    let steps: Int
    let distance: Int
    let calories: Int
}

struct Decoded {
    var stepBuckets: [StepBucket] = []
    var heart: [HeartSample] = []
    var sleep: [SleepSummary] = []
    var totals: Totals?
}

enum Decoder {
    static func u16(_ b: [UInt8], _ i: Int) -> Int { Int(b[i]) << 8 | Int(b[i + 1]) }
    static func u32(_ b: [UInt8], _ i: Int) -> Int {
        Int(b[i]) << 24 | Int(b[i + 1]) << 16 | Int(b[i + 2]) << 8 | Int(b[i + 3])
    }

    static func components(_ b: [UInt8]) -> DateComponents {
        var c = DateComponents()
        c.year = 2000 + Int((b[0] & 0x7F) >> 1)
        c.month = Int((b[0] & 1) << 3) + Int((b[1] & 0xE0) >> 5)
        c.day = Int(b[1] & 0x1F)
        return c
    }

    static func decode(category: UInt8, key: UInt8, payload p: [UInt8]) -> Decoded? {
        guard category == 0x05, p.count >= 2 else { return nil }
        var out = Decoded()
        let cal = Calendar.current
        let comps = components(p)

        switch key {
        case 0x02 where p.count >= 194:
            var total = 0, dist = 0, kcal = 0
            for i in 0..<24 {
                let o = 2 + i * 8
                let steps = u16(p, o)
                if steps == 0xFFFF { continue }
                let d = u16(p, o + 2)
                let k = u32(p, o + 4)
                guard steps > 0 else { continue }
                var cc = comps
                cc.hour = i
                cc.minute = 0
                if let start = cal.date(from: cc) {
                    out.stepBuckets.append(.init(date: cc, start: start, steps: steps, distance: d, calories: k))
                    total += steps; dist += d; kcal += k
                }
            }
            _ = (total, dist, kcal)

        case 0x04 where p.count >= 4:
            let n = Int(p[3])
            for i in 0..<n {
                let o = 4 + i * 8
                guard o + 7 < p.count else { break }
                let sec = u32(p, o)
                let bpm = Int(p[o + 7])
                guard bpm >= 30, bpm <= 220 else { continue }
                var cc = comps
                cc.hour = sec / 3600
                cc.minute = (sec / 60) % 60
                cc.second = sec % 60
                if let ts = cal.date(from: cc) {
                    out.heart.append(.init(date: cc, timestamp: ts, bpm: bpm))
                }
            }

        case 0x09 where p.count >= 12:
            let startMin = u16(p, 2), light = u16(p, 4), deep = u16(p, 6)
            let endMin = u16(p, 8), awake = u16(p, 10)
            guard light < 1440, deep < 1440, awake < 1440, endMin > startMin else { return out }
            var s = comps, e = comps
            s.hour = startMin / 60; s.minute = startMin % 60
            // sleep may end after midnight
            var endDay = cal.date(from: comps) ?? Date()
            if endMin < startMin { endDay = cal.date(byAdding: .day, value: 1, to: endDay) ?? endDay }
            e = cal.dateComponents([.year, .month, .day, .hour, .minute], from: endDay)
            e.hour = endMin / 60; e.minute = endMin % 60
            if let start = cal.date(from: s), let end = cal.date(from: e), end > start {
                out.sleep.append(.init(date: comps, start: start, end: end, light: light, deep: deep, awake: awake))
            }

        case 0x0C where p.count >= 12:
            out.totals = Totals(steps: u32(p, 0), distance: u32(p, 4), calories: u32(p, 8))

        default:
            return nil
        }
        return out
    }
}
