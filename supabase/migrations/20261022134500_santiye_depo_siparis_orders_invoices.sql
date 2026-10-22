-- Şantiye Depo (Sipariş) rolü, Siparişler sayfasında purchasing_officer ile aynı
-- yetkilere sahip olmalı: fatura grupları (invoice_groups) görüntüleme/yönetme ve
-- fatura silme (invoices DELETE) işlemleri de bu role açılıyor.

DROP POLICY IF EXISTS "Authorized roles can manage invoice groups" ON public.invoice_groups;
CREATE POLICY "Authorized roles can manage invoice groups"
ON public.invoice_groups
AS PERMISSIVE
FOR ALL
TO public
USING (
  user_role_cannot_write() AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['admin'::user_role_enum, 'purchasing_officer'::user_role_enum, 'manager'::user_role_enum, 'santiye_depo_siparis'::user_role_enum])
  )
)
WITH CHECK (
  user_role_cannot_write() AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['admin'::user_role_enum, 'purchasing_officer'::user_role_enum, 'manager'::user_role_enum, 'santiye_depo_siparis'::user_role_enum])
  )
);

DROP POLICY IF EXISTS "Yetkili kullanıcılar invoice_groups okuyabilir" ON public.invoice_groups;
CREATE POLICY "Yetkili kullanıcılar invoice_groups okuyabilir"
ON public.invoice_groups
AS PERMISSIVE
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['purchasing_officer'::user_role_enum, 'admin'::user_role_enum, 'manager'::user_role_enum, 'santiye_depo_siparis'::user_role_enum])
  )
);

DROP POLICY IF EXISTS "Admins and purchasing officers can delete invoices" ON public.invoices;
CREATE POLICY "Admins and purchasing officers can delete invoices"
ON public.invoices
AS PERMISSIVE
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = ANY (ARRAY['admin'::user_role_enum, 'manager'::user_role_enum, 'purchasing_officer'::user_role_enum, 'santiye_depo_siparis'::user_role_enum])
  )
  AND EXISTS (SELECT 1 FROM orders WHERE orders.id = invoices.order_id)
);
