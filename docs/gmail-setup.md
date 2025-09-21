# Gmail E-posta Kurulumu Rehberi

## 🔐 Gmail App Password Alma

### 1. Adım: Google Hesap Güvenlik Ayarları
1. **Gmail hesabınıza giriş yapın**
2. **Google Account** → **Security** bölümüne gidin
3. URL: https://myaccount.google.com/security

### 2. Adım: 2-Step Verification Aktifleştir
1. **"2-Step Verification"** bölümünü bulun
2. Eğer kapalıysa **"Get started"** tıklayın
3. Telefon numaranız ile doğrulama yapın
4. 2-Step Verification'ı aktifleştirin

### 3. Adım: App Password Oluştur
1. 2-Step Verification aktif olduktan sonra
2. **"App passwords"** seçeneği görünecek
3. **"App passwords"** tıklayın
4. **"Select app"** → **"Other (Custom name)"** seçin
5. **Name**: "Satın Alma Sistemi" yazın
6. **"Generate"** tıklayın
7. **16 karakterlik şifreyi kopyalayın** (örnek: abcd efgh ijkl mnop)

### 4. Adım: .env.local Dosyasını Oluştur
Proje ana dizininde `.env.local` dosyası oluşturun:

```bash
# Supabase Configuration (mevcut)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM="Satın Alma Sistemi" <noreply@yourcompany.com>

# Push Notifications (mevcut)
NEXT_PUBLIC_VAPID_KEY=BNBrdsbeR4gIebmR5ouW84k9opbd3FMZxWLz6LQHpyaBz7dMoR9mIRjzy64pue9p9MS5g50mIqKxbpsIYcO5wJA
VAPID_PRIVATE_KEY=7IuTHC0wz0G8AIKMDhvwnBjzvaVrOUmRcd5ekVwdFjo
VAPID_EMAIL=mailto:your-email@example.com

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🔧 Alternatif Ücretsiz Seçenekler

### 1. Ethereal Email (Test Amaçlı)
- **Avantaj**: Tamamen ücretsiz, kurulum yok
- **Dezavantaj**: Gerçek e-posta gönderilmez, sadece test
- **Kullanım**: Development ortamında otomatik aktif

### 2. SendGrid Free Tier
1. https://sendgrid.com/free/ 'ye gidin
2. Ücretsiz hesap oluşturun (100 email/month)
3. API Key alın
4. .env.local'de SMTP yerine SendGrid API kullanın

### 3. Brevo (eski Sendinblue)
1. https://www.brevo.com/ 'ye gidin
2. Ücretsiz hesap (300 email/day)
3. SMTP credentials alın

## 🚀 Hızlı Test

### Test Komudu (Development)
Development'te Ethereal Email otomatik çalışır:
```bash
npm run dev
# Settings → Bildirimler → "Test E-postası Gönder"
# Console'da test URL'ini göreceksiniz
```

### Production Test
Gmail App Password ekledikten sonra:
```bash
NODE_ENV=production npm run dev
# Gerçek e-posta gönderilecek
```

## ⚠️ Güvenlik Notları

1. **Asla normal Gmail şifrenizi kullanmayın**
2. **App Password'ü güvenli saklayın**
3. **Gerekirse App Password'ü silin ve yenisini oluşturun**
4. **.env.local dosyasını Git'e eklemeyin** (.gitignore'da olmalı)

## 🔍 Sorun Giderme

### "Invalid credentials" hatası
- App Password doğru mu?
- 2-Step Verification aktif mi?
- SMTP_USER doğru Gmail adresi mi?

### "Less secure app" hatası
- App Password kullanın, normal şifre değil
- Gmail'de "Less secure apps" ayarı artık çalışmıyor

### Test e-postası gelmiyor
- Spam klasörünü kontrol edin
- Gmail'de "All Mail" klasörüne bakın
- Console'da hata mesajları var mı?
