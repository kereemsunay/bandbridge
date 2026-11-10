# BandBridge — React Native

Tek uygulama, iki platform hedefi. HryFine yok, reklam yok, hesap yok.
Bileklikten okunan veriyi Health Connect'e (Android) yazar.

## Durum
- Android: BLE + Health Connect yazma hazır (build doğrulanacak).
- iOS: aynı JS katmanı çalışır; HealthKit köprüsü henüz eklenmedi.
  Şimdilik `~/pbs163/ios` altındaki native SwiftUI app kullanılabilir.

## Çalıştırma (Android)
```bash
cd ~/pbs163/app
npm install
npx react-native run-android
```
veya APK:
```bash
cd android && ./gradlew assembleDebug
# android/app/build/outputs/apk/debug/app-debug.apk
```

Gereksinim: Android 9+ ve Health Connect (Android 14'te yerleşik, 13 ve altında
Play Store'dan "Health Connect" uygulaması).

## Ne yapar
- `PBS163` adlı BLE cihazı NUS servisi üzerinden bulur ve bağlanır.
- Saat senkronu, kimlik (`F3/00`), bağlama (`03/00`), geçmiş (`05/01`),
  gerçek zamanlı adım (`05/06`) komutlarını yollar.
- Her DF frame'ini ACK'ler.
- `key 12` → adım/mesafe/kalori deltası olarak Health Connect'e.
- `key 02` → 15 dk adım blokları, `key 04` → nabız, `key 09` → uyku.
- Health Connect'e yazma izinleri manifestte tanımlı.

## Dosyalar
- `src/protocol.ts` — frame, ACK, zaman, adım/nabız/uyku çözücü
- `src/ble.ts` — tarama, bağlantı, MTU, bildirim, el sıkışma
- `src/health.ts` — Health Connect izinleri ve kayıt yazımı
- `App.tsx` — tek ekran

## Bilinen sınırlar
- Nabız gerçek zamanlı akmıyor; geçmiş senkronunda gelir.
- Geçmiş adım/uyku ancak önceki gün kaydı varsa dolar.
- Android arka planda sürekli BLE için foreground service henüz yok;
  şimdilik uygulama açıkken senkron yapıyor.
