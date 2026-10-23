-- Operasyon transferinde teslim alan çalışan stock_movements.assigned_to olarak yazılır.

DROP FUNCTION IF EXISTS public.transfer_stock_into_operated_warehouse(text, uuid, uuid, numeric, text);

CREATE OR REPLACE FUNCTION public.transfer_stock_into_operated_warehouse(
  p_product_id text,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_quantity numeric,
  p_reason text,
  p_assigned_to text DEFAULT NULL
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

  IF p_assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.employees e WHERE e.id = p_assigned_to
  ) THEN
    RAISE EXCEPTION 'Seçilen çalışan bulunamadı';
  END IF;

  IF NOT (
    public.has_warehouse_manage_all()
    OR EXISTS (
      SELECT 1
      FROM public.warehouse_access wa
      WHERE wa.user_id = v_uid
        AND wa.access_level = 'operate'
        AND wa.warehouse_id IS NOT NULL
    )
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
    AND user_id IS NULL
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.warehouse_stock
    SET quantity = quantity + p_quantity,
        last_updated = now(),
        updated_by = v_uid
    WHERE product_id = p_product_id
      AND warehouse_id = p_to_warehouse_id
      AND user_id IS NULL;
  ELSE
    INSERT INTO public.warehouse_stock (product_id, warehouse_id, user_id, quantity, updated_by, last_updated)
    VALUES (p_product_id, p_to_warehouse_id, NULL, p_quantity, v_uid, now());
    v_to := 0;
  END IF;

  INSERT INTO public.stock_movements (
    product_id, warehouse_id, movement_type, quantity,
    previous_quantity, new_quantity, reason, reference_id, reference_type, created_by, assigned_to
  ) VALUES
  (
    p_product_id, p_from_warehouse_id, 'transfer', p_quantity,
    v_from, v_from - p_quantity,
    'Transfer: ' || COALESCE(p_reason, ''),
    p_to_warehouse_id, 'transfer', v_uid, p_assigned_to
  ),
  (
    p_product_id, p_to_warehouse_id, 'transfer', p_quantity,
    COALESCE(v_to, 0), COALESCE(v_to, 0) + p_quantity,
    'Transfer: ' || COALESCE(p_reason, ''),
    p_from_warehouse_id, 'transfer', v_uid, p_assigned_to
  );
END;
$$;
