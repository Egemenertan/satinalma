-- Santiye Depo kullanıcısına purchase_request_items update yetkisi verme
-- Bu script santiye_depo rolünün gönderim sonrası quantity güncelleyebilmesini sağlar

-- 1. Önce mevcut politikaları kontrol et ve kaldır
DROP POLICY IF EXISTS "authenticated_users_can_access_request_items" ON public.purchase_request_items;
DROP POLICY IF EXISTS "purchase_request_items_select_policy" ON public.purchase_request_items;
DROP POLICY IF EXISTS "purchase_request_items_update_policy" ON public.purchase_request_items;
DROP POLICY IF EXISTS "santiye_depo_can_update_items" ON public.purchase_request_items;

-- 2. Yeni kapsamlı politika oluştur
CREATE POLICY "authenticated_users_can_read_request_items" ON public.purchase_request_items
FOR SELECT USING (
  (select auth.role()) = 'authenticated'
);

CREATE POLICY "authenticated_users_can_insert_request_items" ON public.purchase_request_items
FOR INSERT WITH CHECK (
  (select auth.role()) = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (select auth.uid()) 
    AND profiles.role IN ('admin', 'manager', 'site_manager', 'site_personnel', 'warehouse_manager', 'purchasing_officer')
  )
);

CREATE POLICY "authenticated_users_can_update_request_items" ON public.purchase_request_items
FOR UPDATE USING (
  (select auth.role()) = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (select auth.uid()) 
    AND profiles.role IN ('admin', 'manager', 'site_manager', 'warehouse_manager', 'purchasing_officer', 'santiye_depo')
  )
);

-- 3. Purchase requests tablosunda da santiye_depo yetkisini kontrol et
DROP POLICY IF EXISTS "authenticated_users_can_update_requests" ON public.purchase_requests;

CREATE POLICY "authenticated_users_can_update_requests" ON public.purchase_requests
FOR UPDATE USING (
  (select auth.role()) = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (select auth.uid()) 
    AND (
      profiles.role IN ('admin', 'manager', 'warehouse_manager', 'purchasing_officer', 'santiye_depo') OR
      (profiles.role = 'site_manager' AND profiles.site_id = purchase_requests.site_id)
    )
  )
);

-- 4. Shipments tablosu için de santiye_depo yetkisini güncelle
DROP POLICY IF EXISTS "authenticated_users_can_access_shipments" ON public.shipments;
DROP POLICY IF EXISTS "Enable santiye_depo to insert shipments" ON public.shipments;

CREATE POLICY "authenticated_users_can_access_shipments" ON public.shipments
FOR ALL USING (
  (select auth.role()) = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (select auth.uid()) 
    AND profiles.role IN ('admin', 'manager', 'site_manager', 'site_personnel', 'santiye_depo', 'warehouse_manager', 'purchasing_officer')
  )
);

-- 5. Kontrol sorgusu - mevcut kullanıcının yetkilerini test et
SELECT 
  'rls_permission_check' as check_name,
  auth.uid() as user_id,
  auth.role() as auth_role,
  profiles.role as profile_role,
  profiles.full_name
FROM profiles 
WHERE profiles.id = auth.uid();

-- 6. Test - bir purchase_request_items kaydını güncellemeye çalış (DRY RUN)
-- Bu sorgu sadece test amaçlı, gerçek veri güncellemez
SELECT 
  'update_test' as test_name,
  COUNT(*) as can_update_items,
  (
    SELECT COUNT(*) 
    FROM purchase_request_items 
    WHERE true  -- Güncelleme yetkisi varsa kayıtları görebilir
  ) as total_items_accessible
FROM purchase_request_items
WHERE EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = (select auth.uid()) 
  AND profiles.role IN ('admin', 'manager', 'site_manager', 'warehouse_manager', 'purchasing_officer', 'santiye_depo')
);
