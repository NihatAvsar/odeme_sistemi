# Restaurant QR Payment

Restoranlarda QR kod ile masa menüsü, sipariş isteği, canlı adisyon takibi, kalem bazlı hesap bölüşme ve ödeme yönetimi sağlayan React + Express + Prisma tabanlı uygulama.

Proje iki parçadan oluşur:

- Frontend: React, Vite, TypeScript, Tailwind CSS
- Backend: Express, Prisma, Socket.IO, MySQL

## Temel Özellikler

- QR kod ile masa ekranına giriş
- Müşteri menüsünden sipariş isteği oluşturma
- Admin panelinden sipariş onaylama veya reddetme
- Canlı masa/adisyon güncellemeleri
- Kalem bazlı hesap bölüşme
- Bahşiş ekleme
- Mock ödeme ve iyzico ödeme altyapısı
- Ödeme tamamlanınca masayı otomatik `Temizleniyor` durumuna alma
- 3 dakika sonra masayı otomatik boşa çıkarma
- Admin dashboard, masa yönetimi, mutfak ekranı, raporlar ve masa istekleri
- Menü ürünü ekleme/düzenleme, stok kapatma ve resim URL desteği
- Garson çağırma, hesap isteme ve not gönderme aksiyonları
- Dashboard üzerinde bekleyen sipariş ve masa isteği bildirim rozetleri

## Proje Yapısı

```text
.
├── src/
│   ├── api/                  # Frontend HTTP client fonksiyonları
│   ├── components/           # Ortak UI bileşenleri
│   ├── features/             # Domain odaklı frontend bileşenleri
│   ├── functions/            # Saf yardımcı fonksiyonlar
│   ├── lib/                  # Socket ve query/client yardımcıları
│   ├── routes/               # Müşteri, ödeme ve admin sayfaları
│   └── store/                # Global state yardımcıları
├── server/
│   ├── src/
│   │   ├── controllers/      # Express route controller'ları
│   │   ├── lib/              # Prisma, realtime, audit, metrics yardımcıları
│   │   ├── middleware/       # Auth, validation, rate limit, security middleware
│   │   ├── providers/        # Ödeme provider implementasyonları
│   │   ├── schemas/          # API validation schema'ları
│   │   ├── services/         # Payment, audit, masa release servisleri
│   │   └── types/            # Backend tipleri
│   └── package.json
├── prisma/
│   └── schema.prisma         # MySQL veri modeli
├── package.json              # Frontend/root scriptleri
└── README.md
```

## Gereksinimler

- Node.js
- npm
- MySQL veya MariaDB
- Prisma CLI paketleri proje bağımlılıkları ile gelir

## Kurulum

Bağımlılıkları yükle:

```bash
npm install
npm --prefix server install
```

Frontend environment dosyasını oluştur:

```bash
copy .env.example .env
```

Backend environment dosyasını oluştur:

```bash
copy server\.env.example server\.env
```

`server/.env` içindeki `DATABASE_URL` değerini kendi MySQL bağlantına göre düzenle.

Örnek:

```env
DATABASE_URL="mysql://user:password@127.0.0.1:3306/restaurant"
PORT=3000
CORS_ORIGIN="http://localhost:5173,http://localhost:5174"
ADMIN_SECRET="0711"
PAYMENT_PROVIDER="iyzico"
IYZICO_API_KEY="your-iyzico-api-key"
IYZICO_SECRET_KEY="your-iyzico-secret-key"
IYZICO_BASE_URL="https://sandbox-api.iyzipay.com"
IYZICO_CALLBACK_URL="http://localhost:3000/api/webhooks/iyzico/callback"
```

Frontend `.env` örneği:

```env
VITE_API_BASE_URL="http://localhost:3000"
VITE_SOCKET_URL="http://localhost:3000"
```

## Veritabanı

Prisma client üretimi:

```bash
npm --prefix server run prisma:generate
```

Demo veri ekleme:

```bash
npm --prefix server run seed:demo
```

Not: Projede migration komutu script olarak tanımlı değilse Prisma komutlarını `prisma.config.ts` ayarını dikkate alarak çalıştırman gerekir.

## Çalıştırma

Backend dev server:

```bash
npm --prefix server run dev
```

Frontend dev server:

```bash
npm run dev
```

Varsayılan adresler:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

Vite bazen `5173` doluysa `5174` portuna geçebilir. Bu yüzden backend `CORS_ORIGIN` değerinde iki origin de tanımlanabilir.

## Kullanım Akışları

### Müşteri Akışı

1. Müşteri QR kod ile `/table/:tableCodeOrQrToken` ekranına gelir.
2. Menüye geçer ve ürünleri seçer.
3. Sipariş isteğini restorana gönderir.
4. Admin isteği onaylayınca adisyon oluşur veya mevcut adisyona eklenir.
5. Müşteri adisyonda kalem seçerek ödeme ekranına geçer.
6. Ödeme tamamlanınca adisyon güncellenir.
7. Tüm hesap kapandığında masa `Temizleniyor` durumuna geçer.
8. Süre dolunca masa otomatik `Müşteri yok` durumuna döner.

### Admin Akışı

Admin sayfalarına müşteri ekranından geçerken şifre istenir.

Varsayılan local admin şifresi:

```text
0711
```

Admin içinde sayfalar arasında gezerken tekrar şifre sorulmaz. Müşteri ekranına dönülürse admin oturumu kilitlenir ve admin tarafına tekrar geçerken şifre yeniden istenir.

Admin panelinde yapılabilenler:

- Masa durumlarını görmek
- Bekleyen siparişleri onaylamak/reddetmek
- Masa isteklerini görmek ve çözmek
- Hesap isteğini kasada kapatmak
- Mutfak biletlerini yönetmek
- Menü ürünü eklemek/düzenlemek
- Ürüne resim URL eklemek
- Stok durumunu değiştirmek
- Raporları görüntülemek
- QR kodları görüntülemek, kopyalamak, indirmek veya yazdırmak

## Menü Resim URL Desteği

Admin menü ekranında ürün eklerken veya düzenlerken `Resim URL` alanı kullanılabilir.

Davranış:

- URL girilirse admin formunda önizleme gösterilir.
- Ürün listesinde küçük görsel önizlemesi çıkar.
- Müşteri menüsünde ürün kartının üstünde görsel görünür.
- URL boşsa eski kart görünümü korunur.

Bu özellik dosya yükleme yapmaz. Sadece dışarıdaki veya public erişilebilir bir görsel URL'sini kaydeder.

## Ödeme Akışı

Ödeme başlatma endpoint'i:

```text
POST /api/payments/initiate
```

Ödeme doğrulama endpoint'i:

```text
POST /api/payments/confirm
```

iyzico callback endpoint'i:

```text
POST /api/webhooks/iyzico/callback
```

Ödeme provider seçimi frontend'den yapılmaz. Backend `server/.env` içindeki `PAYMENT_PROVIDER` değerini kullanır. Bu davranış, müşterinin mock provider seçerek gerçek ödemeyi bypass etmesini engellemek için özellikle bu şekilde tasarlanmıştır.

Desteklenen provider adları:

- `iyzico`
- `mock-stripe`
- `mock-iyzico`

Production ortamında mock provider kullanılmamalıdır. Backend production modunda güvenli fallback olarak `iyzico` kullanacak şekilde ayarlanmıştır.

### Lokal iyzico Test Notu

iyzico callback'in çalışması için iyzico sunucularının backend callback URL'ine erişebilmesi gerekir. Lokal `localhost` adresi dışarıdan erişilemez. Gerçek sandbox callback testi için public bir URL gerekir.

Örnek çözümler:

- ngrok
- Cloudflare Tunnel
- Public staging ortamı

`IYZICO_CALLBACK_URL` bu public adrese göre güncellenmelidir.

## Masa Durumları

Kullanılan temel masa durumları:

- `AVAILABLE`: Müşteri yok
- `OCCUPIED`: Müşteri var
- `PENDING_APPROVAL`: Bekleyen sipariş isteği var
- `CLEANING`: Ödeme tamamlandı, masa temizleniyor
- `RESERVED`: Rezerve
- `DISABLED`: Kapalı

Masa temizlenme akışı:

1. Siparişte açık bakiye kalmaz veya kalem bazlı ödemede tüm kalemler ödenir.
2. Sipariş `PAID` olur.
3. Masa `CLEANING` olur.
4. `releaseAt` zamanı atanır.
5. Süre dolunca masa `AVAILABLE` olur.

## Bildirimler ve Realtime

Socket.IO ile canlı güncellenen alanlar:

- Sipariş güncellemeleri
- Ödeme güncellemeleri
- Masa durumu güncellemeleri
- Menü güncellemeleri
- Mutfak ticket güncellemeleri
- Masa aksiyonları

Dashboard bildirim davranışı:

- `Bekleyen Siparişler` rozetinde bekleyen sipariş sayısı gösterilir.
- `Masa İstekleri` rozetinde açık veya görüldü durumundaki masa istekleri gösterilir.
- Bir masa isteği `Görüldü` yapılsa bile rozet kalır.
- Rozet yalnızca istek `Çözüldü` veya `İptal` olduğunda düşer.

## Güvenlik Notları

- Admin secret frontend environment'a gömülmez.
- Admin istekleri `x-admin-secret` header'ı ile doğrulanır.
- Admin socket odalarına katılımda admin secret doğrulanır.
- Public ödeme isteği provider seçemez.
- Webhook endpoint'lerinde rate limit vardır.
- iyzico redirect URL'i sadece `https://*.iyzipay.com` domainleri için kabul edilir.
- Log ve audit payload'larında secret, token, password, card gibi hassas alanlar temizlenir.
- `.env` dosyaları git'e alınmamalıdır.

## Komutlar

Root komutları:

```bash
npm run dev      # Frontend dev server
npm run build    # Frontend TypeScript build + Vite build
npm test         # Server testlerini çalıştırır
```

Server komutları:

```bash
npm --prefix server run dev              # Backend dev server
npm --prefix server run build            # Backend TypeScript build
npm --prefix server test                 # Backend testleri
npm --prefix server run prisma:generate  # Prisma client generate
npm --prefix server run seed:demo        # Demo veri seed
```

## Test ve Doğrulama

Backend testleri:

```bash
npm test
```

Backend typecheck/build:

```bash
npm --prefix server run build
```

Tam build:

```bash
npm run build
```

## Sık Karşılaşılan Sorunlar

### `EADDRINUSE: address already in use :::3000`

Backend portu zaten kullanımda demektir. Portu kullanan process'i bul:

```powershell
netstat -ano | findstr :3000
```

Gerekirse process'i kapat:

```powershell
Stop-Process -Id <PID>
```

### `Failed to fetch`

Olası nedenler:

- Backend çalışmıyor.
- Frontend farklı portta açıldı ve CORS izinli değil.
- `VITE_API_BASE_URL` yanlış.

Kontrol et:

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing
```

### Admin sayfasında veri görünmüyor

Olası nedenler:

- Admin şifresi yanlış girildi.
- Backend yeniden başlatılmadı.
- `ADMIN_SECRET` değeri backend `.env` içinde farklı.

Varsayılan local değer:

```text
0711
```

### iyzico callback dönmüyor

`localhost` dışarıdan erişilemediği için iyzico callback gönderemez. Public URL kullan ve `IYZICO_CALLBACK_URL` değerini güncelle.

## Notlar

- Bu proje restoran operasyon akışını uçtan uca göstermek için geliştirilmiştir.
- Gerçek production kullanımında admin auth için kalıcı kullanıcı/session modeli önerilir.
- Gerçek ödeme ortamına çıkmadan önce iyzico sandbox akışı public callback URL ile test edilmelidir.
- Secret değerleri repository'ye eklenmemelidir.
