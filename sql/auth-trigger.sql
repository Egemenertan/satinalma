-- Supabase Auth kullanıcısı oluşturulduğunda otomatik olarak users tablosuna ekle

-- 1. Trigger fonksiyonu oluştur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, password, is_active, approval_limit, department, phone, construction_site_id, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), -- Email'den isim çıkar
    COALESCE(NEW.raw_user_meta_data->>'role', 'engineer'), -- Varsayılan rol: engineer
    'auth_user', -- Auth kullanıcısı işareti
    true, -- is_active
    0, -- approval_limit
    NULL, -- department
    NULL, -- phone
    NULL, -- construction_site_id
    NEW.created_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger'ı auth.users tablosuna bağla
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Mevcut Auth kullanıcılarını users tablosuna aktar (eğer yoksa)
INSERT INTO public.users (id, email, name, role, password, is_active, approval_limit, department, phone, construction_site_id, created_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  COALESCE(au.raw_user_meta_data->>'role', 'engineer'),
  'auth_user',
  true, -- is_active
  0, -- approval_limit
  NULL, -- department
  NULL, -- phone
  NULL, -- construction_site_id
  au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;
