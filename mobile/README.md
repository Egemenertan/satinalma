# Satınalma mobil (Expo) — web reposundan bağımsız
# Aynı Supabase projesini kullanır.

## Kurulum

```bash
cd mobile
cp .env.example .env
# .env: NEXT_PUBLIC_* (web ile aynı) veya EXPO_PUBLIC_* — ikisi de desteklenir
npm install --legacy-peer-deps
npx expo start -c
```

`.env` değişince Metro önbelleğini temizlemek için `-c` kullanın.

`app.config.js`, `dotenv` ile `mobile/.env` dosyasını okuyup URL ve anon key’i `expo.extra` içine koyar; uygulama bunları `expo-constants` ile alır. Yalnızca `process.env.EXPO_PUBLIC_*` kullanılsaydı `NEXT_PUBLIC_*` kopyalansa bile Metro tarafında boş kalırdı.

## Özellikler (v1)

- E-posta / şifre ile giriş (Supabase Auth)
- Talep listesi: ana liste + (yetkiye göre) IT Yönetim sekmesi, arama, sayfalama — web `PurchaseRequestsTable` rol mantığına uyumlu sorgu
- Yeni talep: kategori → grup → malzeme, sepet, oluşturma (web `createMultiMaterialPurchaseRequest` ile aynı başlangıç durumu / IT tetikleyici)
- Talep detayı: kalemler + düzenlenebilirlik rozeti (web `canEditByRole` + IT istisnası)

## Notlar

- Bildirim/e-posta web sunucusunda kalır; mobil yalnızca `approval_history` ekler.
- RLS politikaları insert/update için uygun değilse talep oluşturma hata verir; gerekirse Supabase Edge Function aşamasına geçilir.
- Bu klasörü ayrı Git reposu olarak da açabilirsiniz; kök Next.js projesine dokunulmaz.
