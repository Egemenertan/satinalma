-- Depoya manage/view yetkisi olan kullanıcı, kendi deposundan çıkan aktif zimmetleri okuyabilsin.
-- Ürün tablosundaki adet, bu kayıtlar okunamadığında 0 kalıyordu.
DROP POLICY IF EXISTS "warehouse_access_select_inventory" ON public.user_inventory;
CREATE POLICY "warehouse_access_select_inventory"
  ON public.user_inventory
  FOR SELECT
  TO authenticated
  USING (
    source_warehouse_id IS NOT NULL
    AND public.can_access_warehouse(source_warehouse_id)
  );
