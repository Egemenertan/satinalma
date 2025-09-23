-- Santiye depo rolü için RLS politikalarını düzeltme
-- Santiye depo kullanıcılarının purchase request oluşturma yetkisi veriliyor

-- 1. Önce mevcut politikaları kaldır
DROP POLICY IF EXISTS "authenticated_users_can_create_requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "authenticated_users_can_update_requests" ON public.purchase_requests;

-- 2. Yeni politikaları santiye_depo rolünü dahil ederek oluştur
CREATE POLICY "authenticated_users_can_create_requests" ON public.purchase_requests
FOR INSERT WITH CHECK (
  (select auth.role()) = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (select auth.uid()) 
    AND profiles.role IN ('admin', 'manager', 'site_manager', 'site_personnel', 'santiye_depo', 'warehouse_manager', 'purchasing_officer')
  )
);

CREATE POLICY "authenticated_users_can_update_requests" ON public.purchase_requests
FOR UPDATE USING (
  (select auth.role()) = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (select auth.uid()) 
    AND (
      profiles.role IN ('admin', 'manager', 'santiye_depo', 'warehouse_manager', 'purchasing_officer') OR
      (profiles.role = 'site_manager' AND profiles.site_id = purchase_requests.site_id)
    )
  )
);

-- 3. Profiles tablosunda santiye_depo rolünün desteklendiğinden emin ol
DO $$
BEGIN
    -- Önce mevcut constraint'i kaldır (varsa)
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
    END IF;
    
    -- Yeni constraint'i santiye_depo rolünü içerecek şekilde oluştur
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

-- 4. Shipments tablosu için de santiye_depo yetkisi ver
DROP POLICY IF EXISTS "authenticated_users_can_access_shipments" ON public.shipments;

CREATE POLICY "authenticated_users_can_access_shipments" ON public.shipments
FOR ALL USING (
  (select auth.role()) = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (select auth.uid()) 
    AND profiles.role IN ('admin', 'manager', 'site_manager', 'site_personnel', 'santiye_depo', 'warehouse_manager', 'purchasing_officer')
  )
);

-- 5. Purchase request items için de yetki ver
DROP POLICY IF EXISTS "authenticated_users_can_access_request_items" ON public.purchase_request_items;

CREATE POLICY "authenticated_users_can_access_request_items" ON public.purchase_request_items
FOR ALL USING (
  (select auth.role()) = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (select auth.uid()) 
    AND profiles.role IN ('admin', 'manager', 'site_manager', 'site_personnel', 'santiye_depo', 'warehouse_manager', 'purchasing_officer')
  )
);

-- Yorum: 
-- Bu migration santiye_depo rolüne aşağıdaki yetkileri verir:
-- 1. Purchase request oluşturma
-- 2. Purchase request güncelleme
-- 3. Shipments tablosuna erişim (gönderim kayıtları için)
-- 4. Purchase request items tablosuna erişim
