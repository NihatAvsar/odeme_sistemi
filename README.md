# Restaurant QR Payment

React + Vite + TypeScript + Tailwind CSS + MySQL tabanlı restoran QR ödeme ve hesap bölüşme iskeleti.

## Yapı

- `src/routes`: sayfalar
- `src/features`: domain bileşenleri
- `src/functions`: saf yardımcılar
- `src/api`: HTTP client
- `src/lib`: query client ve socket yardımcıları
- `src/store`: global durum
- `prisma/schema.prisma`: MySQL veri modeli
- `server/`: Express + Prisma + Socket.IO backend

## Çalıştırma

1. `npm install`
2. `.env.example` dosyasını `.env` olarak kopyala
3. `npm run dev`
4. `cd server && npm install && npm run dev`
5. `cd server && npm run seed:demo`

## Yol Haritası

1. QR ile masa giriş akışı
2. Canlı adisyon senkronizasyonu
3. Kalem bazlı bölüşme
4. Tutar bazlı bölüşme
5. Mock ödeme sağlayıcısı
6. Bahşiş akışı
7. Race condition ve idempotency kontrolü
8. Admin panel ve raporlama
