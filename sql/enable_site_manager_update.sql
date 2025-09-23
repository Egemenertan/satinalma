-- Site Manager UPDATE Permission
-- Bu SQL'i Supabase'de çalıştır

-- Önce mevcut politikaları kontrol et
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'purchase_requests' AND cmd = 'UPDATE';

-- Site manager'lar için UPDATE politikası ekle
CREATE POLICY IF NOT EXISTS "site_managers_can_update_status" 
ON purchase_requests 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'site_manager'
  )
);

-- Kontrol et
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'purchase_requests' AND cmd = 'UPDATE';
