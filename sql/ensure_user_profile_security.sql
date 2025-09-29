-- Profiles tablosu için güvenlik güncellemesi
-- Yeni kullanıcılar için otomatik 'user' rolü atanması ve rol değişikliği engellenmesi

-- 1. Yeni kullanıcı için profil oluşturma trigger'ı
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'user', -- Sabit olarak 'user' rolü ata
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger'ı auth.users tablosuna bağla
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 3. Rol güvenlik constraint'ini güncelle
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
        'purchasing_officer',
        'santiye_depo'
    ));
END $$;

-- 4. RLS politikası: Kullanıcılar kendi rollerini değiştiremez
DROP POLICY IF EXISTS "Users cannot change their own role" ON public.profiles;
CREATE POLICY "Users cannot change their own role" ON public.profiles
  FOR UPDATE USING (
    id = auth.uid() AND 
    (OLD.role = NEW.role OR auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'manager')
    ))
  );

-- 5. Sadece admin ve manager'lar başkalarının rollerini değiştirebilir
DROP POLICY IF EXISTS "Only admins can change roles" ON public.profiles;
CREATE POLICY "Only admins can change roles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- 6. Mevcut kullanıcıların rollerini kontrol et ve gerekirse düzelt
UPDATE profiles 
SET role = 'user' 
WHERE role IS NULL OR role NOT IN (
  'user', 'manager', 'admin', 'site_personnel', 
  'site_manager', 'warehouse_manager', 'purchasing_officer', 'santiye_depo'
);

-- 7. Grant gerekli izinleri
GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO service_role;
