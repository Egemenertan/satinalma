-- Yeni warehouse manager ve purchasing officer rollerini ekleme
-- Bu roller site_manager ile aynı yetkilere sahip olacak

DO $$ 
BEGIN
    -- user_role enum'unu kontrol et ve yeni değerleri ekle
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        -- Yeni rolleri ekle
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'warehouse_manager';
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'purchasing_officer';
    ELSE
        -- Enum yoksa tümüyle oluştur
        CREATE TYPE user_role AS ENUM (
            'user',
            'manager',
            'admin',
            'site_personnel',
            'site_manager',
            'warehouse_manager',
            'purchasing_officer'
        );
    END IF;
END $$;

-- Profil tablosunu güncelle (eğer varsa)
DO $$
BEGIN
    -- profiles tablosu varsa role sütununu kontrol et
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        -- role sütunu yoksa ekle
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
            ALTER TABLE profiles ADD COLUMN role user_role DEFAULT 'user';
        END IF;
    END IF;
END $$;

-- Yorum: 
-- warehouse_manager ve purchasing_officer rolleri site_manager ile aynı yetkilerle çalışacak
-- Dashboard ve requests sayfalarına erişim sağlanacak
-- Bu migration sadece rol tanımlarını genişletir, ayrı yetki kısıtlaması getirmez
