# 🔧 Environment Variables Kurulum Rehberi

## 📝 .env.local Dosyası Oluşturma

Proje ana dizininde `.env.local` dosyası oluşturun ve aşağıdaki içeriği ekleyin:

```bash
# ==============================================
# SATINALMA SİSTEMİ - ENVIRONMENT VARIABLES  
# ==============================================

# 📚 SUPABASE CONFIGURATION
# Bu bilgileri Supabase Dashboard'dan alın: https://app.supabase.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 🤖 OPENAI CONFIGURATION (AI Chatbot için)
# https://platform.openai.com/api-keys adresinden alın
OPENAI_API_KEY=sk-...

# 🔔 PUSH NOTIFICATIONS
# Bu anahtarlar zaten oluşturuldu, değiştirmeyin
NEXT_PUBLIC_VAPID_KEY=BNBrdsbeR4gIebmR5ouW84k9opbd3FMZxWLz6LQHpyaBz7dMoR9mIRjzy64pue9p9MS5g50mIqKxbpsIYcO5wJA
VAPID_PRIVATE_KEY=7IuTHC0wz0G8AIKMDhvwnBjzvaVrOUmRcd5ekVwdFjo
VAPID_EMAIL=mailto:your-email@example.com

# 📧 EMAIL CONFIGURATION
# Gmail App Password nasıl alınır: docs/gmail-setup.md dosyasına bakın
# ZORUNLU: Gmail'de 2-Step Verification aktif olmalı
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM="Satın Alma Sistemi" <noreply@yourcompany.com>

# 🌐 APPLICATION URL
# Development için localhost, production için gerçek domain
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 📍 Bilgileri Nereden Alacağınız:

### 1. 📚 Supabase Bilgileri
```
📍 Nereden: https://app.supabase.com
🚶 Adımlar:
1. Supabase hesabınıza giriş yapın
2. Proje seçin → Settings → API
3. "Project URL" → NEXT_PUBLIC_SUPABASE_URL
4. "anon public" key → NEXT_PUBLIC_SUPABASE_ANON_KEY  
5. "service_role" key → SUPABASE_SERVICE_ROLE_KEY
```

### 2. 🤖 OpenAI API Key
```
📍 Nereden: https://platform.openai.com/api-keys
🚶 Adımlar:
1. OpenAI hesabı oluşturun
2. "Create new secret key" tıklayın
3. Key'i kopyalayın (sk-... ile başlar)
```

### 3. 📧 Gmail App Password
```
📍 Nereden: Google Account Security
🚶 Adımlar:
1. Gmail → Google Account → Security
2. 2-Step Verification aktifleştir
3. App passwords → "Other" seç
4. "Satın Alma Sistemi" adını ver
5. 16 karakterlik şifreyi kopyala
📖 Detaylı rehber: docs/gmail-setup.md
```

### 4. 🔔 Push Notification Keys
```
✅ Hazır! Değiştirmeyin
Bu anahtarlar zaten oluşturulmuş ve çalışıyor
```

### 5. 🌐 App URL
```
Development: http://localhost:3000
Production: https://yourdomain.com
```

## ⚡ Hızlı Başlangıç

### 1. Mevcut .env.local Dosyanız Var mı?
```bash
# Proje dizininde kontrol edin:
ls -la | grep .env.local
```

### 2. Yoksa Oluşturun:
```bash
# Ana dizinde .env.local oluşturun
touch .env.local
```

### 3. İçeriği Ekleyin:
Yukarıdaki template'i kopyalayıp değerleri doldurun

### 4. Test Edin:
```bash
npm run dev
# Settings → Bildirimler → Test butonları
```

## 🔍 Sorun Giderme

### "Environment variable not found" hatası:
- .env.local dosyası proje ana dizininde mi?
- Dosya adı doğru mu? (.env.local)
- Sunucuyu yeniden başlattınız mı? (npm run dev)

### E-posta testi çalışmıyor:
- Gmail App Password doğru mu?
- 2-Step Verification aktif mi?
- SMTP_USER Gmail adresiniz mi?

### Push notification çalışmıyor:
- VAPID keys doğru mu?
- Browser izni verildi mi?
- HTTPS kullanıyor musunuz? (localhost için zorunlu değil)

## 📋 Checklist

- [ ] .env.local dosyası oluşturuldu
- [ ] Supabase URL ve keys eklendi
- [ ] Gmail App Password alındı
- [ ] SMTP ayarları yapıldı
- [ ] npm run dev ile test edildi
- [ ] Settings sayfasında testler çalışıyor
