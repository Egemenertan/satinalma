-- Basit RLS Fix - Site Manager Update Permission
-- Bu sorguyu Supabase SQL Editor'da çalıştırın

-- 1. Mevcut politikaları kaldır (çakışma olmasın)
DROP POLICY IF EXISTS "site_managers_can_update_requests" ON purchase_requests;

-- 2. Yeni basit politika ekle
CREATE POLICY "site_managers_can_update_requests" 
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

-- 3. Kontrol et
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'purchase_requests' AND cmd = 'UPDATE';
