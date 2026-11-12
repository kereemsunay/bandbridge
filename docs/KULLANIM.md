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
2. Senkron başında ve sonunda saat kısa titreşir. Butona basman gerekmez;
   açılışta otomatik çalışır. Büyük buton yalnızca bağlantı yokken veya veri
   gelmediğinde görünür.
3. Ekranda **SENKRON** damgası ve saat görünür.
4. Değerler Health Connect'e yazılır; Sağlık uygulamasında görünür.
   Üst şeritte saatin şarjı görünür.
5. İşin bitince uygulamayı kapatabilirsin; tekrar açtığında yeniden bağlanır.

Elle senkron için **yeniden senkron** bağlantısı. Bağlantıyı kesmek için
**bağlantıyı kes**.

**GECE MODU** anahtarı koyu temaya geçirir; sistem koyuysa uygulama zaten
koyu açılır. Anahtar kapatılınca açık tema. Seçim hatırlanır.

Saat, gün dönümünü kendi iç saatiyle yapar. Saatin tarihi kaymışsa (uzun süre
bağlanılmadıysa) uygulama bağlanırken saati tekrar ayarlar; günlük toplam yine
eski sayıda kalırsa saat bir kez kapatılıp açılmalıdır.

**KAYIT** bölümü son 3 olayı gösterir; **tümü** ile günlük gruplu geçmiş açılır.
Kayıtlar cihazda saklanır (en fazla 500), günler arasında `önceki / sonraki` ile
gezinilir, **temizle** hepsini siler.

## 4. Veriler ve gecikmeler

| Veri | Ne zaman gelir |
|---|---|
| Adım, mesafe, kalori | Bağlanınca; saatteki 15 dakikalık kayıtlardan |
| Nabız | Geçmiş senkronunda; saatte ölçüm yapılmışsa |
| Uyku | Ancak bir gece saat takılıysa, ertesi gün |
| Geçmiş günler | Bir gün tamamlandıktan sonra |
| SpO2, tansiyon, sıcaklık | Cihazda ölçüm varsa, geçmiş senkronunda |
| Antrenman kaydı | Saatten antrenman başlatıldıysa |
| Şarj | Bağlanınca üst şeritte |

Saat iki ayrı sayı gönderir: tarihsiz **günlük toplam** ve **15 dakikalık
kayıtlar**. Tarihsiz toplam, saatin kendi günü dönmediyse dünkü sayıda kalabilir.
Bu yüzden BandBridge ekranda ve Health Connect'te **tarihli 15 dakikalık
kayıtları** esas alır; toplam yalnızca o güne ait kayıt yoksa gösterilir. Böylece
gün değişince sayı sıfırdan başlar ve geçmiş günler karışmaz.

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
- Müzik kontrolü: banttaki müzik ekranında tuşa basınca telefonun aktif
  oynatıcısına sonraki / önceki / oynat-duraklat gönderilir.

### Uygulama içi bildirimler

Aynı bildirim erişimiyle telefon bildirimleri uygulamada listelenir:

1. **"izin ver"** → BandBridge bildirim erişimini aç.
2. Ana ekranda **BİLDİRİM** bölümü son 6 bildirimi gösterir
   (saat, uygulama, başlık, metin).
3. **temizle** listeyi boşaltır.
4. Bildirimler yalnızca cihazda tutulur; saate otomatik gönderilmez.

### Müzik kontrolünü açma

1. Uygulamada **"izin ver"** bağlantısına bas (veya Android Ayarlar →
   Bildirimler → Cihaz ve uygulama bildirimleri → BandBridge).
2. Bildirim erişimini aç.
3. Telefonda Spotify / YouTube Music / herhangi bir oynatıcıda müzik başlat.
4. Saatte müzik ekranını aç, tuşa bas. Uygulama komutu aktif oynatıcıya iletir.

Aktif oynatıcı yoksa kayıt satırında "aktif oynatıcı yok" yazar.

Müzik kontrolünü tamamen kapatmak için satırdaki **kapat** bağlantısına bas.
Durum **KAPALI** olur, bant tuşları yok sayılır; **aç** ile geri gelir. Seçim
uygulama kapanınca da hatırlanır.

Yapılamaz:
- Menü, widget, yeni ekran eklemek (firmware kapalı).
- Firmware yazmak (imaj yok, brick riski).
- Özel kadran yükleme: cihazın kadran listesi okunabilir (`0F/01`); destek
  doğrulanmadan yükleme denenmemeli.

## 7. Bilinen sınırlar

- Arka planda sürekli senkron yok; uygulama açıkken çalışır.
- Nabız gerçek zamanlı akmaz.
- iOS tarafı ayrı native uygulama; HealthKit izni ve imzalama gerekir.
