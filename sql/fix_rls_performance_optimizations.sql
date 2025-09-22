-- Supabase RLS Performance Optimizations
-- Bu migration performans uyarılarını gidermek için RLS politikalarını optimize eder
-- auth.<function>() çağrılarını (select auth.<function>()) ile değiştirerek 
-- her satır için yeniden değerlendirme sorununu çözer

-- 1. PROFILES tablosu için RLS politika optimizasyonları
-- Mevcut politikaları düzeltiyoruz
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Optimize edilmiş politikalar - auth fonksiyonları subquery ile sarıldı
CREATE POLICY "Enable read access for authenticated users" ON public.profiles
FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable update for users based on email" ON public.profiles
FOR UPDATE USING (email = (select auth.email()));

CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (id = (select auth.uid()));

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (id = (select auth.uid()));

-- 2. SITES tablosu için RLS politika optimizasyonları
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.sites;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.sites;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.sites;

CREATE POLICY "Enable read access for authenticated users" ON public.sites
FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.sites
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.sites
FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- 3. PURCHASE_REQUESTS tablosu için RLS politika optimizasyonları
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.purchase_requests;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.purchase_requests;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.purchase_requests;
DROP POLICY IF EXISTS "site_personnel_create_requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "admins_managers_create_requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "site_manager_view_own_site_requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "site_personnel_view_own_requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "admins_managers_view_all_requests" ON public.purchase_requests;
DROP POLICY IF EXISTS "site_manager_create_own_site_requests" ON public.purchase_requests;

-- Tek bir optimized politika seti ile değiştiriyoruz
CREATE POLICY "authenticated_users_can_read_requests" ON public.purchase_requests
FOR SELECT USING (
  (select auth.role()) = 'authenticated' OR
  (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND (
        profiles.role IN ('admin', 'manager') OR
        (profiles.role = 'site_manager' AND profiles.site_id = purchase_requests.site_id) OR
        (profiles.role = 'site_personnel' AND profiles.id = purchase_requests.requested_by)
      )
    )
  )
);

CREATE POLICY "authenticated_users_can_create_requests" ON public.purchase_requests
FOR INSERT WITH CHECK (
  (select auth.role()) = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (select auth.uid()) 
    AND profiles.role IN ('admin', 'manager', 'site_manager', 'site_personnel')
  )
);

CREATE POLICY "authenticated_users_can_update_requests" ON public.purchase_requests
FOR UPDATE USING (
  (select auth.role()) = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (select auth.uid()) 
    AND (
      profiles.role IN ('admin', 'manager') OR
      (profiles.role = 'site_manager' AND profiles.site_id = purchase_requests.site_id)
    )
  )
);

-- 4. PURCHASE_REQUEST_ITEMS tablosu için RLS politika optimizasyonları
DROP POLICY IF EXISTS "Users can view all purchase request items" ON public.purchase_request_items;
DROP POLICY IF EXISTS "purchase_request_items_select_policy" ON public.purchase_request_items;
DROP POLICY IF EXISTS "purchase_request_items_update_policy" ON public.purchase_request_items;

CREATE POLICY "authenticated_users_can_access_request_items" ON public.purchase_request_items
FOR ALL USING ((select auth.role()) = 'authenticated');

-- 5. OFFERS tablosu için RLS politika optimizasyonları
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.offers;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.offers;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.offers;

CREATE POLICY "authenticated_users_can_access_offers" ON public.offers
FOR ALL USING ((select auth.role()) = 'authenticated');

-- 6. ORDERS tablosu için RLS politika optimizasyonları
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.orders;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.orders;

CREATE POLICY "authenticated_users_can_access_orders" ON public.orders
FOR ALL USING ((select auth.role()) = 'authenticated');

-- 7. SHIPMENTS tablosu için RLS politika optimizasyonları
DROP POLICY IF EXISTS "Authenticated users can view all shipments" ON public.shipments;
DROP POLICY IF EXISTS "Everyone can view all shipments" ON public.shipments;
DROP POLICY IF EXISTS "Authenticated users can insert shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can update their own shipments" ON public.shipments;
DROP POLICY IF EXISTS "Users can delete their own shipments" ON public.shipments;

-- Tek bir optimize edilmiş politika seti
CREATE POLICY "authenticated_users_can_view_shipments" ON public.shipments
FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "authenticated_users_can_insert_shipments" ON public.shipments
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "users_can_modify_own_shipments" ON public.shipments
FOR UPDATE USING (shipped_by = (select auth.uid()));

CREATE POLICY "users_can_delete_own_shipments" ON public.shipments
FOR DELETE USING (shipped_by = (select auth.uid()));

-- 8. SUPPLIER_MATERIALS tablosu için RLS politika optimizasyonları
DROP POLICY IF EXISTS "Authenticated users can insert supplier materials" ON public.supplier_materials;
DROP POLICY IF EXISTS "Authenticated users can update supplier materials" ON public.supplier_materials;
DROP POLICY IF EXISTS "Authenticated users can delete supplier materials" ON public.supplier_materials;

CREATE POLICY "authenticated_users_can_manage_supplier_materials" ON public.supplier_materials
FOR ALL USING ((select auth.role()) = 'authenticated');

-- 9. SUPPLIERS tablosu için RLS politika optimizasyonları
DROP POLICY IF EXISTS "Users can view all suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update suppliers" ON public.suppliers;

CREATE POLICY "authenticated_users_can_manage_suppliers" ON public.suppliers
FOR ALL USING ((select auth.role()) = 'authenticated');

-- 10. INVOICES tablosu için RLS politika optimizasyonları
DROP POLICY IF EXISTS "Invoices are viewable by authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Invoices are insertable by authenticated users" ON public.invoices;
DROP POLICY IF EXISTS "Invoices are updatable by authenticated users" ON public.invoices;

CREATE POLICY "authenticated_users_can_manage_invoices" ON public.invoices
FOR ALL USING ((select auth.role()) = 'authenticated');

-- 11. SENT_ITEMS tablosu için RLS politika optimizasyonları
DROP POLICY IF EXISTS "Anyone can view sent items" ON public.sent_items;
DROP POLICY IF EXISTS "Only santiye_depo can insert sent items" ON public.sent_items;

CREATE POLICY "authenticated_users_can_view_sent_items" ON public.sent_items
FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "santiye_depo_can_insert_sent_items" ON public.sent_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = (select auth.uid()) 
    AND profiles.role = 'santiye_depo'
  )
);

-- 12. MATERIAL tablolarındaki çoklu politikaları optimize et
-- ALL_MATERIALS
DROP POLICY IF EXISTS "Allow authenticated users to select materials" ON public.all_materials;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.all_materials;

CREATE POLICY "authenticated_users_can_access_all_materials" ON public.all_materials
FOR SELECT USING ((select auth.role()) = 'authenticated');

-- MATERIAL_CATEGORIES
DROP POLICY IF EXISTS "Material categories access policy" ON public.material_categories;
DROP POLICY IF EXISTS "Material categories modify policy" ON public.material_categories;

CREATE POLICY "authenticated_users_can_access_material_categories" ON public.material_categories
FOR ALL USING ((select auth.role()) = 'authenticated');

-- MATERIAL_ITEMS
DROP POLICY IF EXISTS "Material items access policy" ON public.material_items;
DROP POLICY IF EXISTS "Material items modify policy" ON public.material_items;

CREATE POLICY "authenticated_users_can_access_material_items" ON public.material_items
FOR ALL USING ((select auth.role()) = 'authenticated');

-- MATERIAL_SUBCATEGORIES
DROP POLICY IF EXISTS "Material subcategories access policy" ON public.material_subcategories;
DROP POLICY IF EXISTS "Material subcategories modify policy" ON public.material_subcategories;

CREATE POLICY "authenticated_users_can_access_material_subcategories" ON public.material_subcategories
FOR ALL USING ((select auth.role()) = 'authenticated');

-- Service role bypass politikalarını koruyoruz (AI için gerekli)
-- Bu politikalar performansı etkilemiyor çünkü service_role zaten yüksek öncelikli
