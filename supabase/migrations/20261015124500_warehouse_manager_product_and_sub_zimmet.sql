-- Depo yöneticisi katalogda olmayan ürün ekleyebilsin.
-- Alt zimmet, asıl zimmet kaydına bağlı ayrı satır olarak tutulsun.

ALTER TABLE public.user_inventory
  ADD COLUMN IF NOT EXISTS parent_inventory_id uuid REFERENCES public.user_inventory(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.user_inventory.parent_inventory_id IS
  'Doluysa alt zimmettir. Boş parent, depo sorumlusunun asıl zimmet kaydıdır.';

CREATE INDEX IF NOT EXISTS user_inventory_parent_inventory_id_idx
  ON public.user_inventory (parent_inventory_id);

DROP POLICY IF EXISTS "warehouse_manage_can_insert_products" ON public.products;
CREATE POLICY "warehouse_manage_can_insert_products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_role_cannot_write()
    AND EXISTS (
      SELECT 1
      FROM public.warehouse_access wa
      WHERE wa.user_id = auth.uid()
        AND wa.access_level = 'manage'
        AND wa.warehouse_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "warehouse_manage_can_insert_inventory" ON public.user_inventory;
CREATE POLICY "warehouse_manage_can_insert_inventory"
  ON public.user_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_role_cannot_write()
    AND source_warehouse_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.warehouse_access wa
      WHERE wa.user_id = auth.uid()
        AND wa.access_level = 'manage'
        AND wa.warehouse_id = source_warehouse_id
    )
    AND (
      (parent_inventory_id IS NULL AND user_id = auth.uid())
      OR (
        parent_inventory_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.user_inventory parent
          WHERE parent.id = parent_inventory_id
            AND parent.user_id = auth.uid()
            AND parent.parent_inventory_id IS NULL
            AND parent.source_warehouse_id = user_inventory.source_warehouse_id
        )
      )
    )
  );
