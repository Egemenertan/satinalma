-- all_materials tablosuna authenticated kullanıcılar için INSERT izni ver
-- Bu dosyayı Supabase SQL Editor'de çalıştırın

-- Önce mevcut policy'leri kontrol et
SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'all_materials';

-- RLS açık mı kontrol et
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'all_materials';

-- Eğer RLS açık değilse, aç
-- ALTER TABLE all_materials ENABLE ROW LEVEL SECURITY;

-- Authenticated kullanıcılar için INSERT policy'si ekle
CREATE POLICY "Allow authenticated users to insert materials" 
ON all_materials 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Authenticated kullanıcılar için SELECT policy'si ekle (eğer yoksa)
CREATE POLICY "Allow authenticated users to select materials" 
ON all_materials 
FOR SELECT 
TO authenticated 
USING (true);

-- Policy'lerin oluşturulduğunu doğrula
SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'all_materials';
