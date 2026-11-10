import Foundation
import HealthKit

final class HealthStore {
    static let shared = HealthStore()
    let store = HKHealthStore()

    private let stepTotalKey = "health.lastStepTotal"
    private let stepTotalDayKey = "health.lastStepDay"
    private let stepSampleTimeKey = "health.lastStepSampleEnd"
    private let sleepKey = "health.sleepDates"
    private let hrKey = "health.hrTimes"

    private var types: Set<HKSampleType> {
        var s: Set<HKSampleType> = []
        if let t = HKQuantityType.quantityType(forIdentifier: .stepCount) { s.insert(t) }
        if let t = HKQuantityType.quantityType(forIdentifier: .heartRate) { s.insert(t) }
        if let t = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) { s.insert(t) }
        if let t = HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning) { s.insert(t) }
        if let t = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) { s.insert(t) }
        return s
    }

    func requestAuthorization() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        do {
            try await store.requestAuthorization(toShare: types, read: [])
        } catch {
            print("HealthKit auth: \(error)")
        }
    }

    func isAuthorized() -> Bool {
        guard let t = HKQuantityType.quantityType(forIdentifier: .stepCount) else { return false }
        return store.authorizationStatus(for: t) == .sharingAuthorized
    }

    // MARK: totals delta (key 0x0C)

    func writeTotals(steps: Int, distance: Int, calories: Int) {
        let day = Self.dayString(Date())
        let lastDay = UserDefaults.standard.string(forKey: stepTotalDayKey)
        var last = UserDefaults.standard.integer(forKey: stepTotalKey)
        if lastDay != day { last = 0 }
        let delta = steps >= last ? steps - last : steps
        guard delta > 0 else { return }

        let end = Date()
        let start = (UserDefaults.standard.object(forKey: stepSampleTimeKey) as? Date)
            ?? Calendar.current.startOfDay(for: end)
        let from = max(start, Calendar.current.startOfDay(for: end))
        guard end > from else { return }

        let dSteps = Double(delta)
        let dDist = distance >= 0 ? Double(distance) : 0
        let dCal = calories >= 0 ? Double(calories) : 0

        if let t = HKQuantityType.quantityType(forIdentifier: .stepCount) {
            let q = HKQuantitySample(type: t, quantity: HKQuantity(unit: .count(), doubleValue: dSteps), start: from, end: end)
            store.save(q) { _, e in if let e { print("step save: \(e)") } }
        }
        if let t = HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning), dDist > 0 {
            let q = HKQuantitySample(type: t, quantity: HKQuantity(unit: .meter(), doubleValue: dDist), start: from, end: end)
            store.save(q) { _, e in if let e { print("dist save: \(e)") } }
        }
        if let t = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned), dCal > 0 {
            let q = HKQuantitySample(type: t, quantity: HKQuantity(unit: .kilocalorie(), doubleValue: dCal), start: from, end: end)
            store.save(q) { _, e in if let e { print("cal save: \(e)") } }
        }

        UserDefaults.standard.set(steps, forKey: stepTotalKey)
        UserDefaults.standard.set(day, forKey: stepTotalDayKey)
        UserDefaults.standard.set(end, forKey: stepSampleTimeKey)
    }

    // MARK: history buckets (key 0x02)

    func writeStepBuckets(_ buckets: [StepBucket]) {
        guard let t = HKQuantityType.quantityType(forIdentifier: .stepCount) else { return }
        var written = Set<String>()
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd-HH"
        for b in buckets where b.steps > 0 {
            let key = fmt.string(from: b.start)
            guard !written.contains(key) else { continue }
            written.insert(key)
            let end = b.start.addingTimeInterval(15 * 60)
            let q = HKQuantitySample(type: t, quantity: HKQuantity(unit: .count(), doubleValue: Double(b.steps)), start: b.start, end: end)
            store.save(q) { _, e in if let e { print("bucket save: \(e)") } }
        }
    }

    // MARK: heart (key 0x04)

    func writeHeart(_ samples: [HeartSample]) {
        guard let t = HKQuantityType.quantityType(forIdentifier: .heartRate) else { return }
        var seen = Set<TimeInterval>(UserDefaults.standard.array(forKey: hrKey) as? [TimeInterval] ?? [])
        for s in samples {
            let ts = s.timestamp.timeIntervalSince1970
            guard !seen.contains(ts) else { continue }
            seen.insert(ts)
            let q = HKQuantitySample(type: t,
                                     quantity: HKQuantity(unit: HKUnit.count().unitDivided(by: .minute()), doubleValue: Double(s.bpm)),
                                     start: s.timestamp, end: s.timestamp)
            store.save(q) { _, e in if let e { print("hr save: \(e)") } }
        }
        UserDefaults.standard.set(Array(seen.suffix(5000)), forKey: hrKey)
    }

    // MARK: sleep (key 0x09)

    func writeSleep(_ summaries: [SleepSummary]) {
        guard let t = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) else { return }
        var seen = Set<String>(UserDefaults.standard.array(forKey: sleepKey) as? [String] ?? [])
        let fmt = DateFormatter(); fmt.dateFormat = "yyyy-MM-dd"
        for s in summaries {
            let key = fmt.string(from: s.start)
            guard !seen.contains(key), s.end > s.start else { continue }
            seen.insert(key)
            let q = HKCategorySample(type: t, value: HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
                                     start: s.start, end: s.end)
            store.save(q) { _, e in if let e { print("sleep save: \(e)") } }
        }
        UserDefaults.standard.set(Array(seen.suffix(200)), forKey: sleepKey)
    }

    static func dayString(_ d: Date) -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }
}
