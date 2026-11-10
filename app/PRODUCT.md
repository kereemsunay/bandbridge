# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Tek kullanıcı: Polosmart PBS163 bilekliğini kendi telefonuyla kullanan, haftada birkaç kez halı saha maçı yapan kişi. Telefonu maç sırasında çantada durur; uygulamayı maç öncesi ve sonrasında kısa süreliğine açar. Amacı saatin verisini Apple Health / Health Connect'e geçirmek, HryFine'ı hiç açmamak.

## Product Purpose

Bileklik ile telefonun sağlık uygulaması arasında yerel bir köprü kurmak: BLE üzerinden doğrudan okunan adım, mesafe, kalori, nabız ve uyku verisini reklamsız, hesapsız ve bulutsuz biçimde Health'e yazmak. Başarı: maç sonrası tek ekranda verinin aktığını görmek ve uygulamayı kapatmak.

## Positioning

Vendor uygulamasının tersine mühendislikle çözülmüş protokolü doğrudan konuşur; veri hiçbir sunucuya gitmez, yalnızca cihazda ve seçilen sağlık uygulamasında kalır.

## Operating Context

- Maç öncesi bağlan, maç sonrası senkronize et.
- Telefon maç boyunca cepte/çantada; uygulama ön planda değil.
- Veri günlük toplam olarak gelir; geçmiş günler bir gün sonra dolar.
- Nabız gerçek zamanlı akmaz; geçmiş senkronunda gelir.
- Kullanıcı Türkçe okur.

## Capabilities and Constraints

- BLE bağlantısı, saat senkronu, bağlama, geçmiş ve gerçek zamanlı adım komutları çalışır.
- Bugünkü adım/mesafe/kalori `key 12` ile; geçmiş adım, nabız, uyku sırasıyla `key 02/04/09` ile gelir.
- Health Connect (Android) ve HealthKit (iOS) yazma izni gerekir.
- Android arka plan servisi yok; senkron uygulama açıkken yapılır.
- Uygulama adı BandBridge; paket `com.kereem.pbs163`.

## Brand Commitments

- Ad: BandBridge.
- Dil: Türkçe, sade, teknik olmayan.
- Oyunlaştırma yok: rozet, seri, kutlama, motivasyon cümlesi yok.
- Reklam, hesap, bulut yok.

## Evidence on Hand

Gerçek cihazdan doğrulanmış protokol ve ölçümler (`docs/PROTOCOL.md`). Ekran görüntüleri ve demo değerler sentetiktir; gerçek kullanıcı verisi değildir.

## Product Principles

1. Verinin nereden geldiğini saklamadan göster; olmayan veriyi sıfır gibi gösterme.
2. Sessiz ve ölçülü: sağlık verisi kutlama değil, kayıt.
3. Tek ekran, tek karar: bağlan veya senkronize et.
4. Yerel ve özel: veri cihazdan çıkmaz.
