# Microsoft OAuth Kurulum Rehberi

## 🔄 OAuth Akışı Nasıl Çalışır?

```
1. [Mobil App] → supabase.auth.signInWithOAuth()
   ↓ redirectTo: com.dovec.satinalma://auth/callback

2. [Supabase] → Azure OAuth URL üretir
   ↓ https://login.microsoftonline.com/.../authorize
   ↓ redirect_uri: https://SUPABASE_URL/auth/v1/callback

3. [Mobil App] → WebBrowser ile Azure login sayfası açılır
   ↓

4. [Kullanıcı] → Microsoft hesabı ile giriş yapar
   ↓

5. [Azure] → Supabase'e yönlendirir
   ↓ https://SUPABASE_URL/auth/v1/callback?code=AZURE_CODE

6. [Supabase] → Code'u token ile değiştirir ve session oluşturur
   ↓ Mobil app'e yönlendirir: com.dovec.satinalma://auth/callback?code=SUPABASE_CODE

7. [Mobil App] → Callback URL'i yakalar
   ↓ exchangeCodeForSession() ile session alır
   ↓ Login tamamlanır ✅
```

## 📱 Production Build (Gerekli)

**Önemli:** Expo Go'da OAuth **ÇALIŞMAZ**. Production ve test için development build gerekir.

### iOS Development Build

```bash
cd mobile

# Native dosyaları oluştur
npx expo prebuild --platform ios

# iOS simulator'da çalıştır
npx expo run:ios

# Fiziksel cihazda çalıştır
npx expo run:ios --device
```

### Android Development Build

```bash
cd mobile

# Native dosyaları oluştur
npx expo prebuild --platform android

# Android emulator'da çalıştır
npx expo run:android

# Fiziksel cihazda çalıştır (USB debugging açık olmalı)
npx expo run:android --device
```

## ⚙️ Azure Portal Ayarları

**Portal:** https://portal.azure.com

1. **Azure Active Directory** > **App registrations** > Uygulamanızı seçin

2. **Authentication** sekmesi

### Platform Yapılandırması

#### **Web** (Supabase için)
```
Redirect URI: https://yxzmxfwpgsqabtamnfql.supabase.co/auth/v1/callback
Type: Web
```

#### **Mobile and desktop applications** (Mobil app için)
```
Redirect URIs:
- com.dovec.satinalma://auth/callback
```

### Advanced Settings
```
☑ Allow public client flows: YES
```

### Token Configuration (Optional Claims)
```
- email
- name
- preferred_username
```

## ⚙️ Supabase Dashboard Ayarları

**Dashboard:** https://supabase.com/dashboard/project/yxzmxfwpgsqabtamnfql

### Authentication > URL Configuration

#### **Site URL**
```
https://dovec.app
```
(Web uygulamanızın adresi)

#### **Redirect URLs** (Allowed Redirect URLs)
```
https://dovec.app/**
https://yxzmxfwpgsqabtamnfql.supabase.co/auth/v1/callback
com.dovec.satinalma://**
```

### Authentication > Providers > Azure

```
☑ Enabled
Azure Client ID: [Azure'dan alın]
Azure Secret: [Azure'dan alın]
Azure URL: https://login.microsoftonline.com/[TENANT_ID]/v2.0
```

## 🐛 Sorun Giderme

### Problem: "WebAuthenticationSession error 1"
**Neden:** Expo Go kullanıyorsunuz  
**Çözüm:** Development build kullanın (`npx expo run:ios`)

### Problem: "Redirect URI mismatch"
**Neden:** Azure'da redirect URI kayıtlı değil  
**Çözüm:** 
1. Azure Portal > Authentication
2. `com.dovec.satinalma://auth/callback` ekleyin
3. Save

### Problem: "Invalid redirect URI"
**Neden:** Supabase'de redirect URL allowed değil  
**Çözüm:**
1. Supabase Dashboard > URL Configuration
2. Redirect URLs listesine `com.dovec.satinalma://**` ekleyin
3. Save

### Problem: Web sitesine yönlendiriyor (dovec.app)
**Neden:** Azure'da web platform redirect URI'si öncelikli  
**Çözüm:**
1. Azure'da "Mobile and desktop applications" platformunu ekleyin
2. Custom redirect URI'yi buraya ekleyin: `com.dovec.satinalma://auth/callback`

## 📦 Production Build (App Store / Play Store)

### iOS Production Build (EAS)

```bash
# EAS Build servisini kullan
eas build --platform ios --profile production

# Veya lokal build
npx expo build:ios
```

### Android Production Build (EAS)

```bash
# EAS Build servisini kullan
eas build --platform android --profile production

# Veya lokal build
npx expo build:android
```

## 🔒 Güvenlik Notları

1. **Client Secret'ı güvenli tutun** - Asla Git'e commit etmeyin
2. **Redirect URI'leri kısıtlayın** - Sadece gerekli olanları ekleyin
3. **HTTPS kullanın** - Production'da http:// asla kullanmayın
4. **Token'ları güvenli saklayın** - AsyncStorage şifreleme kullanın (opsiyonel)

## ✅ Test Checklist

- [ ] Azure'da web platform eklendi (`https://SUPABASE_URL/auth/v1/callback`)
- [ ] Azure'da mobile platform eklendi (`com.dovec.satinalma://auth/callback`)
- [ ] Supabase'de redirect URLs eklendi
- [ ] Development build oluşturuldu (`npx expo run:ios` veya `npx expo run:android`)
- [ ] Microsoft ile giriş test edildi
- [ ] Callback başarılı oldu ve session oluşturuldu
- [ ] Profile bilgileri çekildi
- [ ] Dashboard'a yönlendirme yapıldı
