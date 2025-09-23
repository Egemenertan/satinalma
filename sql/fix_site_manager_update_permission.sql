-- Site Manager Update Permission Fix
-- Bu sorguyu Supabase SQL Editor'da çalıştırın

-- 1. Önce mevcut RLS politikalarını kontrol et
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'purchase_requests' AND cmd = 'UPDATE';

-- 2. Site manager için UPDATE politikası ekle (yoksa)
CREATE POLICY IF NOT EXISTS "site_managers_can_update_requests" 
ON purchase_requests 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'site_manager'
    AND (
      profiles.site_id = purchase_requests.site_id 
      OR profiles.site_id IS NULL  -- Admin site manager
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'site_manager'
    AND (
      profiles.site_id = purchase_requests.site_id 
      OR profiles.site_id IS NULL  -- Admin site manager
    )
  )
);

-- 3. Alternatif: Basit stored procedure yöntemi
CREATE OR REPLACE FUNCTION update_request_status_by_site_manager(
  request_id UUID,
  new_status TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Bu fonksiyon admin yetkisiyle çalışır
AS $$
DECLARE
  user_role TEXT;
  user_site_id UUID;
  request_site_id UUID;
BEGIN
  -- Kullanıcının bilgilerini al
  SELECT role, site_id INTO user_role, user_site_id
  FROM profiles 
  WHERE id = auth.uid();
  
  -- Talebin site_id'sini al
  SELECT site_id INTO request_site_id
  FROM purchase_requests 
  WHERE id = request_id;
  
  -- Yetki kontrolü
  IF user_role = 'site_manager' AND (user_site_id = request_site_id OR user_site_id IS NULL) THEN
    -- Update yap
    UPDATE purchase_requests 
    SET 
      status = new_status,
      updated_at = NOW()
    WHERE id = request_id;
    
    RETURN TRUE;
  ELSE
    RAISE EXCEPTION 'Site manager yetkisi yok: user_role=%, user_site=%, request_site=%', 
                    user_role, user_site_id, request_site_id;
  END IF;
END;
$$;

-- 4. Test (isteğe bağlı)
-- SELECT update_request_status_by_site_manager('63f3246d-94c5-40c6-8410-fc8844ef7949', 'satın almaya gönderildi');
