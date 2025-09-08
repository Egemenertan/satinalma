-- Profiles tablosundaki role check constraint'ini güncelleme
-- Yeni warehouse_manager ve purchasing_officer rollerini kabul edecek şekilde

DO $$
BEGIN
    -- Önce mevcut constraint'i kaldır (varsa)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
    END IF;
    
    -- Yeni constraint'i tüm rolleri içerecek şekilde oluştur
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN (
        'user',
        'manager', 
        'admin',
        'site_personnel',
        'site_manager',
        'warehouse_manager',
        'purchasing_officer'
    ));
END $$;
