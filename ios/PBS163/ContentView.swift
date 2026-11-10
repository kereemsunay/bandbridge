import SwiftUI

private enum C {
    static let ground = Color(hex: 0xE7EBE2)
    static let paper = Color(hex: 0xF3F5EC)
    static let ink = Color(hex: 0x121814)
    static let muted = Color(hex: 0x5A645C)
    static let rule = Color(hex: 0xC3CABF)
    static let green = Color(hex: 0x125B3B)
    static let red = Color(hex: 0x9E3527)
}

private extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

struct ContentView: View {
    @StateObject private var band = BandManager()
    @State private var healthOK = false
    @State private var now = Date()
    @State private var stampIn = false

    private let mono = Font.system(size: 21, design: .monospaced)
    private let clockTick = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    private var dateLine: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "tr_TR")
        f.dateFormat = "d MMMM EEEE"
        return f.string(from: now).uppercased(with: f.locale)
    }

    private var clock: String {
        now.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits))
    }

    var body: some View {
        VStack(spacing: 0) {
            cover
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    sectionHead
                    table
                    actionButton
                    footRow
                    logSection
                }
                .padding(.horizontal, 22)
                .padding(.top, 20)
                .padding(.bottom, 36)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
            .background(C.ground)
        }
        .background(C.ground)
        .onReceive(clockTick) { now = $0 }
        .task {
            await HealthStore.shared.requestAuthorization()
            healthOK = HealthStore.shared.isAuthorized()
            band.onDecoded = { d in
                if let t = d.totals {
                    HealthStore.shared.writeTotals(steps: t.steps, distance: t.distance, calories: t.calories)
                }
                if !d.stepBuckets.isEmpty { HealthStore.shared.writeStepBuckets(d.stepBuckets) }
                if !d.heart.isEmpty { HealthStore.shared.writeHeart(d.heart) }
                if !d.sleep.isEmpty { HealthStore.shared.writeSleep(d.sleep) }
            }
            band.start()
        }
        .onChange(of: band.lastSync) { _, newValue in
            guard newValue != nil else { return }
            stampIn = false
            withAnimation(.spring(response: 0.45, dampingFraction: 0.62)) {
                stampIn = true
            }
        }
        .preferredColorScheme(.light)
    }

    private var cover: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("BANDBRIDGE")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(2.6)
                    .foregroundStyle(C.paper)
                Spacer()
                Text(clock)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(C.paper.opacity(0.72))
            }
            Rectangle()
                .fill(C.paper.opacity(0.38))
                .frame(height: 0.5)
                .padding(.top, 9)
            Text(dateLine)
                .font(.system(size: 26, weight: .heavy))
                .tracking(-0.6)
                .foregroundStyle(C.paper)
                .padding(.top, 14)
            HStack(spacing: 8) {
                Circle()
                    .fill(band.connected ? C.paper : C.paper.opacity(0.45))
                    .frame(width: 6, height: 6)
                Text(band.connected ? "BAĞLI" : "BAĞLI DEĞİL")
                    .font(.system(size: 10, weight: .bold))
                    .tracking(1.7)
                    .foregroundStyle(C.paper)
                if !detail.isEmpty {
                    Text(detail)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(C.paper.opacity(0.7))
                        .lineLimit(1)
                }
            }
            .padding(.top, 9)
        }
        .padding(.horizontal, 22)
        .padding(.top, 14)
        .padding(.bottom, 20)
        .frame(maxWidth: 560)
        .frame(maxWidth: .infinity)
        .background(C.green.ignoresSafeArea(edges: .top))
    }

    private var detail: String {
        switch band.status {
        case "Bağlı değil", "Bağlandı", "Bağlantı koptu": return ""
        default: return band.status
        }
    }

    private var sectionHead: some View {
        HStack {
            Text("BUGÜN")
                .font(.system(size: 10, weight: .bold))
                .tracking(2)
                .foregroundStyle(C.muted)
            Spacer()
            if band.lastSync != nil && healthOK {
                VStack(spacing: 1) {
                    Text("AKTARILDI")
                        .font(.system(size: 9.5, weight: .heavy))
                        .tracking(1.8)
                    Text(band.lastSync!.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits)))
                        .font(.system(size: 8.5, design: .monospaced))
                }
                .foregroundStyle(C.green)
                .padding(.vertical, 4)
                .padding(.horizontal, 9)
                .overlay(Rectangle().stroke(C.green, lineWidth: 1.5))
                .rotationEffect(.degrees(-3.5))
                .opacity(stampIn ? 1 : 0)
                .scaleEffect(stampIn ? 1 : 1.2)
            } else {
                Text(healthOK ? "BEKLEMEDE" : "SAĞLIK İZNİ YOK")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(1.4)
                    .foregroundStyle(C.muted)
            }
        }
        .frame(minHeight: 46)
    }

    private var table: some View {
        VStack(spacing: 0) {
            row("ADIM", band.todaySteps > 0 || band.lastSync != nil ? fmt(band.todaySteps) : "—")
            row("MESAFE", band.lastSync != nil ? distance(band.todayDistance) : "—")
            row("KALORİ", band.lastSync != nil ? "\(fmt(band.todayCalories)) kcal" : "—")
            row("NABIZ", "—")
            row("UYKU", "—", last: true)
        }
        .padding(.top, 4)
    }

    private func row(_ label: String, _ value: String, last: Bool = false) -> some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(.system(size: 10.5, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(C.muted)
                Spacer()
                Text(value)
                    .font(mono)
                    .foregroundStyle(C.ink)
                    .lineLimit(1)
            }
            .padding(.vertical, 12)
            if !last {
                Rectangle().fill(C.rule).frame(height: 0.5)
            }
        }
    }

    private var actionButton: some View {
        Button {
            if band.connected { band.syncNow() } else { band.start() }
        } label: {
            Text(band.connected ? "SENKRONİZE ET" : "BAĞLAN")
                .font(.system(size: 12.5, weight: .heavy))
                .tracking(1.8)
                .foregroundStyle(C.paper)
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .background(C.ink)
        }
        .buttonStyle(.plain)
        .padding(.top, 28)
    }

    private var footRow: some View {
        HStack {
            Text("HEALTHKIT · \(healthOK ? "AÇIK" : "İZİN YOK")")
                .font(.system(size: 9.5, weight: .bold))
                .tracking(1.2)
                .foregroundStyle(healthOK ? C.green : C.red)
            Spacer()
            if band.connected {
                Button("bağlantıyı kes") { band.stop() }
                    .font(.system(size: 11))
                    .foregroundStyle(C.muted)
                    .underline()
                    .buttonStyle(.plain)
            }
        }
        .padding(.top, 12)
    }

    private var logSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("KAYIT")
                .font(.system(size: 10, weight: .bold))
                .tracking(2)
                .foregroundStyle(C.muted)
                .padding(.top, 32)
                .padding(.bottom, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(C.ink).frame(height: 1.5)
                }

            if band.logs.isEmpty {
                Text("Henüz kayıt yok. Saatini bağla.")
                    .font(.system(size: 10.5, design: .monospaced))
                    .foregroundStyle(C.muted)
                    .padding(.vertical, 12)
            } else {
                ForEach(Array(band.logs.suffix(6).enumerated()), id: \.offset) { _, line in
                    let parts = line.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true)
                    HStack(alignment: .firstTextBaseline) {
                        Text(parts.first.map(String.init) ?? "")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(C.muted)
                            .frame(width: 52, alignment: .leading)
                        Text(parts.count > 1 ? String(parts[1]) : "")
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(C.ink)
                            .lineLimit(1)
                    }
                    .padding(.vertical, 8)
                    .overlay(alignment: .bottom) {
                        Rectangle().fill(C.rule).frame(height: 0.5)
                    }
                }
            }
        }
    }

    private func fmt(_ n: Int) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "tr_TR")
        return f.string(from: NSNumber(value: n)) ?? "\(n)"
    }

    private func distance(_ m: Int) -> String {
        m >= 1000 ? String(format: "%.1f km", Double(m) / 1000).replacingOccurrences(of: ".", with: ",") : "\(m) m"
    }
}
