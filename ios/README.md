# PBS163 iOS

Tek ekran, reklamsız, hesapsız. Bileklikten adım/nabız/uyku/kalori/mesafe okuyup
Apple Health'e yazar. HryFine gerekmez.

## Gereksinim
- Xcode 26+
- iPhone (BLE ve HealthKit gerçek cihazda çalışır)
- Ücretsiz Apple ID (7 günlük imza) veya geliştirici hesabı

## Çalıştırma
1. `open PBS163.xcodeproj`
2. `PBS163` target → Signing & Capabilities → Team seç.
   - Bundle ID çakışırsa `com.kereem.pbs163` değiştir.
3. iPhone'u bağla, Run.
4. İlk açılışta Bluetooth + Sağlık izinlerini ver.
5. Saat ekranına dokun, uygulamada "Bağlan".

## Ne yapar
- Açılışta saatle eşleşir (NUS `6E400001…`).
- Saat senkronu, cihaz kimliği, bağlama (`03/00`), geçmiş (`05/01`),
  gerçek zamanlı adım (`05/06`) komutlarını yollar.
- Gelen her frame'i ACK'ler.
- `key 12` toplam adım/mesafe/kalori → Health'e delta olarak yazar.
- `key 02` 15 dk adım, `key 04` nabız, `key 09` uyku → Health.
- Bağlantı koparsa 4 sn sonra tekrar dener; `bluetooth-central` arka plan modu açık.

## Sınırlar
- Bugünün adımı `key 12` ile gelir; geçmiş günler `key 02` ile (bir gün sonra).
- Nabız gerçek zamanlı akmıyor; ölçümler geçmiş senkronunda (`key 04`) gelir.
- Uyku ancak bir gece takıldıktan sonra `key 09` ile gelir.
- HealthKit'e yazmak için uygulamanın imzalı olması şart.
