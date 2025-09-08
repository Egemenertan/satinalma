-- Suppliers tablosu için RLS politikalarını düzelt
-- Bu dosyayı Supabase SQL Editor'de çalıştırın

-- Önce mevcut policy'leri kontrol et
SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'suppliers';

-- RLS açık mı kontrol et
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'suppliers';

-- Eğer RLS kapalıysa aç
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Mevcut policy'leri sil (varsa)
DROP POLICY IF EXISTS "Suppliers are viewable by all authenticated users" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers are insertable by authenticated users" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers are updatable by authenticated users" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers are deletable by authenticated users" ON public.suppliers;

-- Yeni policy'ler oluştur
-- Tüm authenticated kullanıcılar suppliers tablosunu okuyabilir
CREATE POLICY "Suppliers are viewable by all authenticated users" 
ON public.suppliers 
FOR SELECT 
TO authenticated 
USING (true);

-- Authenticated kullanıcılar supplier ekleyebilir
CREATE POLICY "Suppliers are insertable by authenticated users" 
ON public.suppliers 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Authenticated kullanıcılar supplier güncelleyebilir
CREATE POLICY "Suppliers are updatable by authenticated users" 
ON public.suppliers 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Authenticated kullanıcılar supplier silebilir
CREATE POLICY "Suppliers are deletable by authenticated users" 
ON public.suppliers 
FOR DELETE 
TO authenticated 
USING (true);

-- Policy'lerin oluşturulduğunu doğrula
SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'suppliers';

-- Test query - bu çalışmalı
SELECT COUNT(*) as supplier_count FROM public.suppliers;
