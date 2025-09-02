-- Yeni kullanıcı rolleri ekleme
-- Bu migration mevcut rolleri koruyarak yeni rolleri ekler
-- Hiçbir ayrıcalık eklenmez, sadece rol tanımları genişletilir

-- Eğer user_roles enum'u varsa, yeni değerleri ekle
-- Mevcut kullanıcılar etkilenmez, tüm roller aynı yetkilerle çalışır

DO $$ 
BEGIN
    -- user_role enum'unu kontrol et ve yoksa oluştur
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM (
            'engineer',
            'site_supervisor', 
            'procurement_specialist',
            'finance_manager',
            'project_manager',
            'general_manager',
            'chief',
            'approver',
            'muhendis',
            'proje_sorumlusu', 
            'satin_alma_sorumlusu',
            'admin'
        );
    ELSE
        -- Varsa yeni değerleri ekle
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'muhendis';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'proje_sorumlusu';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'satin_alma_sorumlusu';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
    END IF;
END $$;

-- Profil tablosunu güncelle (eğer varsa)
DO $$
BEGIN
    -- profiles tablosu varsa role sütununu kontrol et
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        -- role sütunu yoksa ekle
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
            ALTER TABLE profiles ADD COLUMN role user_role DEFAULT 'engineer';
        END IF;
    END IF;
END $$;

-- Yorum: 
-- Bu migration sadece rol tanımlarını genişletir
-- Hiçbir özel yetki veya kısıtlama eklenmez
-- Tüm kullanıcılar aynı işlevlere erişmeye devam eder
-- Roller sadece görsel ayrım ve gelecekteki geliştirmeler için hazırlık amaçlıdır
