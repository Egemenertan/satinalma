# 🏗️ Satın Alma Talebi Yönetim Sistemi

**Enterprise-level güvenlik** ile donatılmış, role-based access control destekli satın alma talebi yönetim sistemi.

## 🔒 **Güvenlik Özellikleri**

### **1. Supabase Auth Entegrasyonu**
- **JWT Token** tabanlı kimlik doğrulama
- **Session management** ile güvenli oturum yönetimi
- **Automatic token refresh** ile sürekli güvenlik

### **2. Middleware Güvenliği**
- **Route protection** - korumalı rotalar
- **Authentication check** - her istekte kimlik doğrulama
- **Role-based access control** - rol bazlı erişim kontrolü
- **Automatic redirects** - yetkisiz erişimde login'e yönlendirme

### **3. Row Level Security (RLS)**
- **Database-level security** - veritabanı seviyesinde güvenlik
- **User isolation** - kullanıcılar sadece kendi verilerini görebilir
- **Role-based policies** - roller bazında veri erişimi
- **SQL injection protection** - otomatik SQL injection koruması

### **4. Server Actions Güvenliği**
- **Authentication required** - tüm işlemler için kimlik doğrulama
- **Role validation** - her işlem için rol kontrolü
- **Input validation** - giriş verilerinin doğrulanması
- **Error handling** - güvenli hata yönetimi

## 🚀 **Özellikler**

### **Role-Based Dashboard**
- **Şantiye Sorumlusu (Engineer)**: Talep oluşturma ve görüntüleme
- **Satın Alma Şefi (Chief)**: Teklif yönetimi ve sipariş işaretleme
- **Onaylayıcı (Approver)**: Onay/red kararları

### **Otomatik İş Akışı**
1. **Engineer** talep oluşturur → Status: `pending_offers`
2. **Chief** 3 teklif ekler → Status: `approval_needed` (>5000 GBP) veya `ready_to_order` (≤5000 GBP)
3. **Approver** onaylar/reddeder → Status: `approved`/`rejected`
4. **Chief** sipariş işaretler → Status: `ordered`

## 🛠️ **Teknolojiler**

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js Server Actions, Supabase
- **UI Components**: shadcn/ui, Lucide React
- **Forms**: React Hook Form, Zod validation
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **Security**: RLS, Middleware, JWT

## 📋 **Kurulum**

### **1. Bağımlılıkları Yükle**
```bash
npm install
```

### **2. Environment Variables**
`.env.local` dosyası oluşturun:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### **3. Veritabanı Kurulumu**
Supabase'de aşağıdaki tabloları oluşturun:

#### **users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('engineer', 'chief', 'approver')),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **purchase_requests**
```sql
CREATE TABLE purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES users(id),
  material TEXT NOT NULL,
  quantity DECIMAL NOT NULL,
  unit TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_offers' 
    CHECK (status IN ('pending_offers', 'approval_needed', 'ready_to_order', 'approved', 'ordered', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **offers**
```sql
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES purchase_requests(id),
  supplier TEXT NOT NULL,
  price DECIMAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  delivery_date DATE NOT NULL,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### **approvals**
```sql
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES purchase_requests(id),
  approved_by UUID REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  comment TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **4. RLS Politikaları**
```sql
-- Users tablosu - sadece kendi verilerini okuyabilir
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Purchase requests - role-based access
CREATE POLICY "Engineers can create purchase requests" ON purchase_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'engineer'
    )
  );

CREATE POLICY "Users can read purchase requests" ON purchase_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND (
        users.role = 'chief' OR 
        users.role = 'approver' OR
        (users.role = 'engineer' AND created_by = auth.uid())
      )
    )
  );

-- Offers - sadece chief'lar
CREATE POLICY "Chiefs can create offers" ON offers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'chief'
    )
  );

-- Approvals - sadece approver'lar
CREATE POLICY "Approvers can create approvals" ON approvals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'approver'
    )
  );
```

### **5. Projeyi Çalıştır**
```bash
npm run dev
```

## 🔐 **Demo Hesaplar**

```
Engineer:  ahmet@example.com / demo123
Chief:     mehmet@example.com / demo123  
Approver:  fatma@example.com / demo123
```

## 🏗️ **Proje Yapısı**

```
src/
├── app/
│   ├── auth/
│   │   └── login/          # Login sayfası
│   ├── dashboard/          # Ana dashboard
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Ana sayfa (redirect)
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── CreateRequestDialog.tsx
│   ├── AddOfferDialog.tsx
│   ├── ApprovalDialog.tsx
│   └── RoleSwitcher.tsx
├── lib/
│   ├── supabase/           # Supabase konfigürasyonu
│   ├── actions.ts          # Server Actions
│   └── utils.ts            # Utility functions
└── middleware.ts            # Güvenlik middleware
```

## 🚀 **Kullanım**

### **1. Giriş Yapma**
- `/auth/login` sayfasından demo hesaplarla giriş yapın
- Sistem otomatik olarak dashboard'a yönlendirir

### **2. Role-Based Access**
- **Engineer**: Talep oluşturma ve görüntüleme
- **Chief**: Teklif ekleme ve sipariş işaretleme
- **Approver**: Onay/red kararları

### **3. İş Akışı**
1. Engineer talep oluşturur
2. Chief 3 teklif ekler
3. Sistem otomatik status günceller
4. Approver onaylar/reddeder
5. Chief sipariş işaretler

## 🔒 **Güvenlik Katmanları**

### **Layer 1: Network Level**
- HTTPS zorunlu
- CORS koruması
- Rate limiting

### **Layer 2: Application Level**
- Middleware authentication
- Route protection
- Input validation

### **Layer 3: Database Level**
- RLS policies
- SQL injection protection
- User isolation

### **Layer 4: Session Level**
- JWT tokens
- Secure cookies
- Automatic refresh

## 📱 **Responsive Design**

- **Mobile-first** yaklaşım
- **Tailwind CSS** ile responsive grid
- **shadcn/ui** components
- **Touch-friendly** interface

## 🚀 **Deployment**

### **Vercel (Önerilen)**
```bash
npm run build
vercel --prod
```

### **Environment Variables**
Production'da güvenli environment variables kullanın:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 🔧 **Development**

### **Scripts**
```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run type-check   # TypeScript check
```

### **Code Quality**
- **ESLint** konfigürasyonu
- **TypeScript** strict mode
- **Prettier** formatting
- **Husky** pre-commit hooks

## 🐛 **Troubleshooting**

### **Common Issues**
1. **TypeScript Errors**: `npm run type-check`
2. **Build Errors**: `npm run build`
3. **Database Connection**: Environment variables kontrol edin
4. **Auth Issues**: Supabase Auth settings kontrol edin

### **Debug Mode**
```bash
DEBUG=* npm run dev
```

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details

## 🆘 **Support**

- **Issues**: GitHub Issues
- **Documentation**: [README.md](README.md)
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)

---

**⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!**

**🔒 Enterprise-level güvenlik ile production-ready!**
