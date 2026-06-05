# Microsoft OAuth Akış Diyagramı

## 🔐 Başarılı OAuth Akışı

```
┌─────────────┐         ┌──────────┐         ┌─────────┐         ┌─────────────┐
│  Mobil App  │         │ Supabase │         │  Azure  │         │  Mobil App  │
│             │         │          │         │   AD    │         │  (Callback) │
└──────┬──────┘         └────┬─────┘         └────┬────┘         └──────┬──────┘
       │                     │                    │                     │
       │  1. signInWithOAuth │                    │                     │
       │  redirectTo:        │                    │                     │
       │  com.dovec.app://   │                    │                     │
       ├────────────────────>│                    │                     │
       │                     │                    │                     │
       │  2. OAuth URL       │                    │                     │
       │  (Azure login page) │                    │                     │
       │<────────────────────┤                    │                     │
       │                     │                    │                     │
       │  3. WebBrowser.openAuthSessionAsync     │                     │
       │     (Kullanıcı login sayfasını görür)   │                     │
       ├────────────────────────────────────────>│                     │
       │                     │                    │                     │
       │                     │  4. User Login     │                     │
       │                     │     (Email/Pass)   │                     │
       │                     │                    │                     │
       │                     │  5. Redirect to    │                     │
       │                     │  Supabase callback │                     │
       │                     │  with Azure code   │                     │
       │                     │<───────────────────┤                     │
       │                     │                    │                     │
       │                     │  6. Exchange code  │                     │
       │                     │     for token      │                     │
       │                     ├───────────────────>│                     │
       │                     │                    │                     │
       │                     │  7. Access Token   │                     │
       │                     │<───────────────────┤                     │
       │                     │                    │                     │
       │  8. Redirect to app │                    │                     │
       │     callback URL    │                    │                     │
       │     com.dovec.app://auth/callback?code=xxx                     │
       ├────────────────────────────────────────────────────────────────>
       │                     │                    │                     │
       │  9. exchangeCodeForSession(code)         │                     │
       ├────────────────────>│                    │                     │
       │                     │                    │                     │
       │ 10. Session + User  │                    │                     │
       │<────────────────────┤                    │                     │
       │                     │                    │                     │
       │ 11. ensureProfile() │                    │                     │
       │ 12. router.replace('/requests')          │                     │
       │                     │                    │                     │
       ✓ Login Başarılı!     │                    │                     │
```

## 🚫 Şu Anki Sorun (Expo Go)

```
┌─────────────┐         ┌──────────┐         ┌─────────┐
│  Mobil App  │         │ Supabase │         │  Azure  │
│  (Expo Go)  │         │          │         │   AD    │
└──────┬──────┘         └────┬─────┘         └────┬────┘
       │                     │                    │
       │  1. signInWithOAuth │                    │
       ├────────────────────>│                    │
       │                     │                    │
       │  2. OAuth URL       │                    │
       │<────────────────────┤                    │
       │                     │                    │
       │  3. WebBrowser.openAuthSessionAsync     │
       │  redirectTo: exp://192.168.103.30:8081  │
       ├────────────────────────────────────────>│
       │                     │                    │
       ✗ iOS WebAuthenticationSession           │
         exp:// scheme'ini tanımıyor!            │
         Error 1: Operation couldn't be completed
       │                     │                    │
       │  ❌ BAŞARISIZ        │                    │
       │  (cancel)           │                    │
       │                     │                    │
```

**Neden Başarısız?**
- iOS WebAuthenticationSession sadece şu scheme'leri kabul eder:
  - `https://` (web URLs)
  - Sistem seviyesinde registered custom schemes
- `exp://` Expo Go tarafından handle edilir ama iOS'a registered DEĞİL
- Sonuç: Callback geri dönemez

## ✅ Çözüm: Development Build

```
┌─────────────────┐
│  npx expo       │
│  prebuild       │
│                 │
│  - iOS klasörü  │    Custom scheme (com.dovec.satinalma://)
│    oluşturulur  │──> iOS Info.plist'e kaydedilir
│  - Android      │──> Android Manifest'e kaydedilir
│    klasörü      │
│    oluşturulur  │    
└─────────────────┘
         │
         │  npx expo run:ios
         ↓
┌─────────────────┐
│  Development    │    ✅ OAuth ÇALIŞIR
│  Build          │    ✅ WebAuthenticationSession
│  (Registered    │       custom scheme'i tanır
│   scheme ile)   │    ✅ Callback başarılı
└─────────────────┘
```

## 📋 Redirect URI Eşleşmesi

### Azure Yapılandırması
```
Platform: Mobile and desktop applications
Redirect URI: com.dovec.satinalma://auth/callback
             ↑
             Bu URI mobil app tarafından kullanılır
```

### Supabase Yapılandırması  
```
Redirect URLs: com.dovec.satinalma://**
              ↑
              Wildcard kullan, tüm path'ler çalışsın
```

### Mobil App Kodu
```typescript
const redirectTo = 'com.dovec.satinalma://auth/callback'
                   ↑
                   Azure ve Supabase'deki ile AYNI olmalı
```

## 🔄 URL Transformasyonları

### Adım 5-6: Azure → Supabase
```
Azure'dan gelen:
https://yxzmxfwpgsqabtamnfql.supabase.co/auth/v1/callback
  ?code=AZURE_CODE_123456
  &state=RANDOM_STATE
```

### Adım 8: Supabase → Mobil App
```
Supabase'den gelen:
com.dovec.satinalma://auth/callback
  ?code=SUPABASE_CODE_789012
```

**Önemli:** İki farklı code var!
- `AZURE_CODE`: Azure'dan Supabase'e giden
- `SUPABASE_CODE`: Supabase'den mobil app'e giden

## 🎯 Sorun Giderme Decision Tree

```
Microsoft ile giriş çalışmıyor mu?
│
├─> WebBrowser error 1 (iOS)?
│   └─> Expo Go kullanıyorsun
│       └─> ✅ Development build yap: npx expo run:ios
│
├─> "Redirect URI mismatch" hatası?
│   └─> Azure'da URI kayıtlı değil
│       └─> ✅ Azure > Authentication > Add redirect URI
│
├─> dovec.app web sitesine yönlendiriyor?
│   └─> Azure'da web platform öncelikli
│       └─> ✅ "Mobile and desktop" platform ekle
│
└─> "Invalid redirect URI" (Supabase)?
    └─> Supabase'de allowed değil
        └─> ✅ Supabase > URL Config > Add redirect URL
```

## 📱 Platform Farklılıkları

### iOS
```
✓ WebAuthenticationSession (güvenli, native)
✓ Sistem seviyesinde registered scheme gerekli
✗ Expo Go'da custom scheme registered değil
✓ Development build'de çalışır
```

### Android  
```
✓ Chrome Custom Tabs (güvenli, native)
✓ Daha esnek redirect handling
✓ Expo Go'da bile çalışabilir (bazen)
✓ Development build'de garanti çalışır
```

## 🚀 Production Deployment

```
Development Build Test
       ↓
    ✅ Çalışıyor
       ↓
EAS Build (Production)
       ↓
  App Store / Play Store
       ↓
    End Users
```

**Not:** Production'da da aynı custom scheme (`com.dovec.satinalma://`) kullanılır!
