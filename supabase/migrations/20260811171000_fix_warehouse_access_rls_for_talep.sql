-- Talep akışı tüm depo stokunu okuyabilsin; yazma depo atamasına bağlı kalsın.
-- warehouse_id NULL satırlar (kullanıcı zimmet stoku) için özel kural.

CREATE OR REPLACE FUNCTION public.has_talep_stock_read()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN (
        'admin'::user_role_enum,
        'manager'::user_role_enum,
        'warehouse_manager'::user_role_enum,
        'santiye_depo'::user_role_enum,
        'santiye_depo_yonetici'::user_role_enum,
        'purchasing_officer'::user_role_enum
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_warehouse(p_warehouse_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_warehouse_manage_all()
    OR (
      p_warehouse_id IS NULL
      AND (
        public.has_talep_stock_read()
        OR EXISTS (
          SELECT 1 FROM public.warehouse_access WHERE user_id = auth.uid()
        )
      )
    )
    OR (
      p_warehouse_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.warehouse_access
        WHERE user_id = auth.uid()
          AND warehouse_id = p_warehouse_id
          AND access_level IN ('view', 'manage')
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_read_warehouse_stock(p_warehouse_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_talep_stock_read()
    OR public.can_access_warehouse(p_warehouse_id);
$$;

GRANT EXECUTE ON FUNCTION public.has_talep_stock_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_warehouse_stock(uuid) TO authenticated;

DROP POLICY IF EXISTS "warehouse_stock_select_by_access" ON public.warehouse_stock;
CREATE POLICY "warehouse_stock_select_by_access"
  ON public.warehouse_stock
  FOR SELECT
  TO authenticated
  USING (public.can_read_warehouse_stock(warehouse_id));

DROP POLICY IF EXISTS "stock_movements_select_by_access" ON public.stock_movements;
CREATE POLICY "stock_movements_select_by_access"
  ON public.stock_movements
  FOR SELECT
  TO authenticated
  USING (public.can_read_warehouse_stock(warehouse_id));
