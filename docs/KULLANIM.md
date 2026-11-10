# BandBridge kullanım yönergesi

Bu dosya, uygulamayı senden bağımsız kullanabilmen için. Tek seferlik kurulum
ve günlük kullanım ayrı.

## 1. Kurulum (bir kez)

1. `dist/bandbridge.apk` dosyasını telefona kopyala veya `adb install -r` ile kur.
2. Android "bilinmeyen kaynak" uyarısı çıkarsa izin ver.
3. Uygulamayı aç. İzinler:
   - **Yakındaki cihazlar** (Bluetooth tarama/bağlanma) → İzin ver.
   - **Health Connect** ekranı açılır → Adım, Nabız, Uyku, Kalori, Mesafe
     için **yazma** izni ver. Android 13 ve altında Health Connect uygulamasını
     Play Store'dan kurman gerekir.

## 2. Bağlanma (eşleştirme diye ayrı bir mod yok)

Saat, başka bir cihaza bağlı değilken kendi adıyla yayın verir. Uygulama bu
yayını görünce bağlanır. Yapılacaklar:

1. HryFine'ı tamamen kapat (arka planda açık kalmasın). Sildiysen sorun yok.
2. Telefonda Bluetooth açık olsun.
3. Saatin ekranına dokun, ana kadrana dön.
4. Uygulamada **BAĞLAN**'a bas.
5. Ekranda "Saat aranıyor → Bağlanıyor" paneli çıkar; bağlanınca kapanır ve
   saat bir kez kısa titreşir.

### Bulamazsa

- Telefonun Bluetooth ayarlarında eski `PBS163` kaydı varsa **eşleşmeyi kaldır**.
- Saati kapat-aç. Şarj kablosundaysa çıkar (bazı modellerde şarjda yayın kesilir).
- Saati telefonun 1–2 metre yakınında tut.
- Saatin menüsünde **Reset / Bluetooth sıfırla / Unbind** varsa onu çalıştır.
- Uygulamada tekrar **BAĞLAN**.

Uygulama içinde de aynı yönerge var: ana ekranda **"nasıl bağlanır?"**.

## 3. Günlük kullanım

1. Uygulamayı aç; saat otomatik bağlanır ve senkron başlar.
2. Senkron başında ve sonunda saat kısa titreşir.
3. Ekranda **SENKRON** damgası ve saat görünür.
4. Değerler Health Connect'e yazılır; Sağlık uygulamasında görünür.
5. İşin bitince uygulamayı kapatabilirsin; tekrar açtığında yeniden bağlanır.

Elle senkron için **SENKRONİZE ET**. Bağlantıyı kesmek için **bağlantıyı kes**.

## 4. Veriler ve gecikmeler

| Veri | Ne zaman gelir |
|---|---|
| Adım, mesafe, kalori | Bağlanınca anında (günün toplamı) |
| Nabız | Geçmiş senkronunda; saatte ölçüm yapılmışsa |
| Uyku | Ancak bir gece saat takılıysa, ertesi gün |
| Geçmiş günler | Bir gün tamamlandıktan sonra |

Bugünün toplamı `0` görünüyorsa saat gerçekten o gün adım saymamış olabilir;
uygulama sahte değer üretmez.

## 5. Kalori birimi

Saat ekranında **cal** (küçük kalori) yazar. BandBridge bunu **kcal**'e çevirir:
saat 1131 cal gösteriyorsa uygulama **1,1 kcal** gösterir ve Health'e kcal yazar.

## 6. Saatte neler yapılabilir, neler yapılamaz

Yapılabilir:
- Titreşim + ekran açma (senkron başlangıç/bitiş).
- Metin bildirimi, arama ekranı, hava durumu push.
- Saat/12-24 saat/birim ayarı.
- Alarm, hareketsizlik ve su hatırlatıcı (protokolde mevcut; uygulama arayüzü
  henüz eklemedi).

Yapılamaz:
- Menü, widget, yeni ekran eklemek (firmware kapalı).
- Firmware yazmak (imaj yok, brick riski).
- Özel kadran yükleme: cihazın kadran listesi okunabilir (`0F/01`); destek
  doğrulanmadan yükleme denenmemeli.

## 7. Bilinen sınırlar

- Arka planda sürekli senkron yok; uygulama açıkken çalışır.
- Nabız gerçek zamanlı akmaz.
- iOS tarafı ayrı native uygulama; HealthKit izni ve imzalama gerekir.
