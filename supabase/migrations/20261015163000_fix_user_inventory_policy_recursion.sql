-- user_inventory INSERT politikası aynı tabloyu okuyunca Postgres
-- "infinite recursion detected in policy" hatası veriyor ve zimmet kaydı düşüyordu.
-- Üst zimmet kontrolü, RLS dışı security definer fonksiyonda yapılır.

CREATE OR REPLACE FUNCTION private.inventory_parent_is_actor_primary(
  p_parent_id uuid,
  p_warehouse_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_inventory AS parent
    WHERE parent.id = p_parent_id
      AND parent.user_id = auth.uid()
      AND parent.parent_inventory_id IS NULL
      AND parent.source_warehouse_id = p_warehouse_id
      AND parent.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION private.inventory_parent_is_actor_primary(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.inventory_parent_is_actor_primary(uuid, uuid) FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.inventory_parent_is_actor_primary(uuid, uuid) TO authenticated;

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
      parent_inventory_id IS NULL
      OR private.inventory_parent_is_actor_primary(parent_inventory_id, source_warehouse_id)
    )
  );
