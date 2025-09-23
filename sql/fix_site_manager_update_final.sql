-- Site Manager Update Permission Final Fix
-- Bu SQL'i Supabase SQL Editor'da çalıştırın

-- 1. Önce mevcut politikaları kontrol et
SELECT 
    policyname, 
    cmd, 
    qual as condition_text,
    WITH_CHECK as check_condition
FROM pg_policies 
WHERE tablename = 'purchase_requests' AND cmd = 'UPDATE'
ORDER BY policyname;

-- 2. Mevcut site manager politikasını kaldır (varsa)
DROP POLICY IF EXISTS "site_managers_can_update_requests" ON purchase_requests;
DROP POLICY IF EXISTS "site_managers_can_update_status" ON purchase_requests;

-- 3. Yeni basit politika ekle - Site manager'lar tüm talepleri güncelleyebilir
CREATE POLICY "site_managers_update_requests" 
ON purchase_requests 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'site_manager'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'site_manager'
  )
);

-- 4. Stored procedure oluştur (alternatif yöntem)
CREATE OR REPLACE FUNCTION update_request_status_by_site_manager(
  request_id UUID,
  new_status TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Admin yetkisiyle çalışır
AS $$
DECLARE
  user_role TEXT;
  user_id UUID;
BEGIN
  -- Mevcut kullanıcının bilgilerini al
  user_id := auth.uid();
  
  SELECT role INTO user_role
  FROM profiles 
  WHERE id = user_id;
  
  -- Debug bilgileri
  RAISE NOTICE 'Function called with: user_id=%, user_role=%, request_id=%, new_status=%', 
               user_id, user_role, request_id, new_status;
  
  -- Yetki kontrolü
  IF user_role = 'site_manager' THEN
    -- Update yap
    UPDATE purchase_requests 
    SET 
      status = new_status,
      updated_at = NOW()
    WHERE id = request_id;
    
    -- Kaç satır etkilendiğini kontrol et
    IF FOUND THEN
      RAISE NOTICE 'Successfully updated request % to status %', request_id, new_status;
      RETURN TRUE;
    ELSE
      RAISE NOTICE 'No rows updated for request %', request_id;
      RETURN FALSE;
    END IF;
  ELSE
    RAISE EXCEPTION 'Access denied: user_role=% (expected: site_manager)', user_role;
  END IF;
END;
$$;

-- 5. Test fonksiyonu (isteğe bağlı - gerçek request ID kullanın)
-- SELECT update_request_status_by_site_manager('your-request-id-here', 'satın almaya gönderildi');

-- 6. Kontrol: Güncel politikaları listele
SELECT 
    policyname, 
    cmd, 
    qual as condition_text
FROM pg_policies 
WHERE tablename = 'purchase_requests' 
ORDER BY cmd, policyname;

-- 7. Profil tablosu RLS kontrolü (site_manager rolünün okunabilir olduğundan emin ol)
SELECT 
    policyname, 
    cmd
FROM pg_policies 
WHERE tablename = 'profiles' 
ORDER BY cmd, policyname;
