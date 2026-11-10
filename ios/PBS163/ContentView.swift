import SwiftUI

struct ContentView: View {
    @StateObject private var band = BandManager()
    @State private var healthOK = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    statusCard

                    HStack(spacing: 12) {
                        metric("Adım", "\(band.todaySteps)", "figure.walk")
                        metric("Mesafe", "\(band.todayDistance) m", "point.topleft.down.to.point.bottomright.curvepath")
                    }
                    HStack(spacing: 12) {
                        metric("Kalori", "\(band.todayCalories)", "flame")
                        metric("Batarya", band.battery.map { "\($0)%" } ?? "—", "battery.75")
                    }

                    HStack(spacing: 12) {
                        Button {
                            band.syncNow()
                        } label: {
                            Label("Şimdi senkronize et", systemImage: "arrow.triangle.2.circlepath")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)

                        Button {
                            band.connected ? band.stop() : band.start()
                        } label: {
                            Label(band.connected ? "Bırak" : "Bağlan", systemImage: "antenna.radiowaves.left.and.right")
                        }
                        .buttonStyle(.bordered)
                    }

                    if !healthOK {
                        Text("Sağlık izni verilmedi. Sağlık uygulamasına yazmak için izin gerekiyor.")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    logCard
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("PBS163")
            .navigationBarTitleDisplayMode(.inline)
        }
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
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Circle()
                    .fill(band.connected ? Color.green : Color.secondary)
                    .frame(width: 9, height: 9)
                Text(band.status).font(.headline)
                Spacer()
                if let d = band.lastSync {
                    Text(d, style: .time).font(.caption).foregroundStyle(.secondary)
                }
            }
            Text("HryFine yok. Reklam yok. Veri yalnızca cihazında ve Sağlık'ta.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private func metric(_ title: String, _ value: String, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(title, systemImage: icon)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(.title2, design: .rounded).weight(.semibold))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }

    private var logCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Günlük")
                .font(.caption).foregroundStyle(.secondary)
            ForEach(band.logs.suffix(12), id: \.self) { line in
                Text(line)
                    .font(.system(.caption2, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}
