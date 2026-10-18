-- Operasyon rolü: depo yönetiminin yazma yetkileri, artı başka depodan
-- kendi deposuna stok çekip zimmet veya teslim yapabilme.

ALTER TABLE public.warehouse_access
  DROP CONSTRAINT IF EXISTS warehouse_access_access_level_check;

ALTER TABLE public.warehouse_access
  ADD CONSTRAINT warehouse_access_access_level_check
  CHECK (access_level IN ('view', 'manage', 'operate'));

COMMENT ON COLUMN public.warehouse_access.access_level IS
  'view: yalnızca görür. manage: kendi deposunda giriş ve alt zimmet. operate: manage yetkileri ve ürün detayında düzeltme, zimmet, teslim.';

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
          AND access_level IN ('view', 'manage', 'operate')
      )
    );
$$;

-- Operasyon kullanıcısı kaynak depo seçebilsin diye stok ve zimmeti okuyabilir.
-- Yazma hâlâ yalnızca kendi deposunda (can_access_warehouse).
CREATE OR REPLACE FUNCTION public.can_read_warehouse_stock(p_warehouse_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_talep_stock_read()
    OR public.can_access_warehouse(p_warehouse_id)
    OR (
      p_warehouse_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.warehouse_access
        WHERE user_id = auth.uid()
          AND access_level = 'operate'
          AND warehouse_id IS NOT NULL
      )
    );
$$;

DROP POLICY IF EXISTS "warehouse_access_select_inventory" ON public.user_inventory;
CREATE POLICY "warehouse_access_select_inventory"
  ON public.user_inventory
  FOR SELECT
  TO authenticated
  USING (
    source_warehouse_id IS NOT NULL
    AND (
      public.can_access_warehouse(source_warehouse_id)
      OR EXISTS (
        SELECT 1
        FROM public.warehouse_access wa
        WHERE wa.user_id = auth.uid()
          AND wa.access_level = 'operate'
          AND wa.warehouse_id IS NOT NULL
      )
    )
  );

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
        AND wa.access_level IN ('manage', 'operate')
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
        AND wa.access_level IN ('manage', 'operate')
        AND wa.warehouse_id = source_warehouse_id
    )
    AND (
      parent_inventory_id IS NULL
      OR private.inventory_parent_is_actor_primary(parent_inventory_id, source_warehouse_id)
    )
  );

DROP POLICY IF EXISTS "zimmet_operations_select" ON public.zimmet_operations;
CREATE POLICY "zimmet_operations_select"
  ON public.zimmet_operations
  FOR SELECT
  TO authenticated
  USING (
    public.has_warehouse_manage_all()
    OR EXISTS (
      SELECT 1
      FROM public.warehouse_access wa
      WHERE wa.user_id = auth.uid()
        AND wa.access_level IN ('manage', 'operate')
    )
  );

DROP POLICY IF EXISTS "zimmet_operations_insert" ON public.zimmet_operations;
CREATE POLICY "zimmet_operations_insert"
  ON public.zimmet_operations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    performed_by = auth.uid()
    AND (
      public.has_warehouse_manage_all()
      OR EXISTS (
        SELECT 1
        FROM public.warehouse_access wa
        WHERE wa.user_id = auth.uid()
          AND wa.access_level IN ('manage', 'operate')
      )
    )
  );

-- Operasyon rolü, yetkili olduğu depoya başka depodan stok çekebilir.
-- Kaynak deponun boş stoğundan fazla miktar taşınmaz.
CREATE OR REPLACE FUNCTION public.transfer_stock_into_operated_warehouse(
  p_product_id text,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_quantity numeric,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_from numeric;
  v_zimmet numeric;
  v_to numeric;
  v_free numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı';
  END IF;

  IF NOT public.user_role_cannot_write() THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok';
  END IF;

  IF p_product_id IS NULL OR p_from_warehouse_id IS NULL OR p_to_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Depo ve ürün seçin';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Geçerli miktar girin';
  END IF;

  IF p_from_warehouse_id = p_to_warehouse_id THEN
    RETURN;
  END IF;

  IF NOT (
    public.has_warehouse_manage_all()
    OR EXISTS (
      SELECT 1
      FROM public.warehouse_access wa
      WHERE wa.user_id = v_uid
        AND wa.warehouse_id = p_to_warehouse_id
        AND wa.access_level IN ('manage', 'operate')
    )
  ) THEN
    RAISE EXCEPTION 'Bu depoya aktarma yetkiniz yok';
  END IF;

  SELECT quantity
  INTO v_from
  FROM public.warehouse_stock
  WHERE product_id = p_product_id
    AND warehouse_id = p_from_warehouse_id
    AND user_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kaynak depoda stok yok';
  END IF;

  SELECT COALESCE(SUM(quantity), 0)
  INTO v_zimmet
  FROM public.user_inventory
  WHERE product_id = p_product_id
    AND source_warehouse_id = p_from_warehouse_id
    AND status = 'active';

  v_free := GREATEST(0, COALESCE(v_from, 0) - COALESCE(v_zimmet, 0));
  IF v_free < p_quantity THEN
    RAISE EXCEPTION 'Kaynak depoda yeterli boş stok yok';
  END IF;

  UPDATE public.warehouse_stock
  SET quantity = quantity - p_quantity,
      last_updated = now(),
      updated_by = v_uid
  WHERE product_id = p_product_id
    AND warehouse_id = p_from_warehouse_id
    AND user_id IS NULL;

  SELECT quantity
  INTO v_to
  FROM public.warehouse_stock
  WHERE product_id = p_product_id
    AND warehouse_id = p_to_warehouse_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.warehouse_stock
    SET quantity = quantity + p_quantity,
        last_updated = now(),
        updated_by = v_uid
    WHERE product_id = p_product_id
      AND warehouse_id = p_to_warehouse_id;
  ELSE
    INSERT INTO public.warehouse_stock (product_id, warehouse_id, user_id, quantity, updated_by, last_updated)
    VALUES (p_product_id, p_to_warehouse_id, NULL, p_quantity, v_uid, now());
    v_to := 0;
  END IF;

  INSERT INTO public.stock_movements (
    product_id, warehouse_id, movement_type, quantity,
    previous_quantity, new_quantity, reason, reference_id, reference_type, created_by
  ) VALUES
  (
    p_product_id, p_from_warehouse_id, 'transfer', p_quantity,
    v_from, v_from - p_quantity,
    'Transfer: ' || COALESCE(p_reason, ''),
    p_to_warehouse_id, 'transfer', v_uid
  ),
  (
    p_product_id, p_to_warehouse_id, 'transfer', p_quantity,
    COALESCE(v_to, 0), COALESCE(v_to, 0) + p_quantity,
    'Transfer: ' || COALESCE(p_reason, ''),
    p_from_warehouse_id, 'transfer', v_uid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_stock_into_operated_warehouse(text, uuid, uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_stock_into_operated_warehouse(text, uuid, uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.transfer_stock_into_operated_warehouse(text, uuid, uuid, numeric, text) TO authenticated;
