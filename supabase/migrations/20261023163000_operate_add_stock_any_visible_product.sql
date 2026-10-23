-- Operasyon kullanıcısı gördüğü her ürüne yetkili deposuna stok girişi yapabilir.

CREATE OR REPLACE FUNCTION public.add_stock_into_operated_warehouse(
  p_product_id text,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_reason text DEFAULT NULL,
  p_supplier_name text DEFAULT NULL,
  p_product_condition text DEFAULT NULL,
  p_unit_price numeric DEFAULT NULL,
  p_currency text DEFAULT 'TRY',
  p_serial_number text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev numeric := 0;
  v_new numeric;
  v_movement_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı';
  END IF;

  IF p_product_id IS NULL OR p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Depo ve ürün seçin';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Geçerli miktar girin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = p_product_id) THEN
    RAISE EXCEPTION 'Ürün bulunamadı';
  END IF;

  IF NOT (
    public.has_warehouse_manage_all()
    OR EXISTS (
      SELECT 1
      FROM public.warehouse_access wa
      WHERE wa.user_id = v_uid
        AND wa.warehouse_id = p_warehouse_id
        AND wa.access_level IN ('manage', 'operate')
    )
  ) THEN
    RAISE EXCEPTION 'Bu depoya giriş yetkiniz yok';
  END IF;

  SELECT quantity
  INTO v_prev
  FROM public.warehouse_stock
  WHERE product_id = p_product_id
    AND warehouse_id = p_warehouse_id
    AND user_id IS NULL
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.warehouse_stock
    SET quantity = quantity + p_quantity,
        last_updated = now(),
        updated_by = v_uid
    WHERE product_id = p_product_id
      AND warehouse_id = p_warehouse_id
      AND user_id IS NULL;
    v_prev := COALESCE(v_prev, 0);
  ELSE
    INSERT INTO public.warehouse_stock (product_id, warehouse_id, user_id, quantity, updated_by, last_updated)
    VALUES (p_product_id, p_warehouse_id, NULL, p_quantity, v_uid, now());
    v_prev := 0;
  END IF;

  v_new := v_prev + p_quantity;

  INSERT INTO public.stock_movements (
    product_id, warehouse_id, movement_type, quantity,
    previous_quantity, new_quantity, reason, reference_type,
    created_by, supplier_name, product_condition, unit_price, currency, serial_number
  ) VALUES (
    p_product_id, p_warehouse_id, 'giriş', p_quantity,
    v_prev, v_new,
    COALESCE(p_reason, ''),
    'manual',
    v_uid,
    NULLIF(btrim(COALESCE(p_supplier_name, '')), ''),
    NULLIF(btrim(COALESCE(p_product_condition, '')), ''),
    p_unit_price,
    COALESCE(NULLIF(btrim(COALESCE(p_currency, '')), ''), 'TRY'),
    NULLIF(btrim(COALESCE(p_serial_number, '')), '')
  )
  RETURNING id INTO v_movement_id;

  IF p_unit_price IS NOT NULL AND p_unit_price > 0 THEN
    UPDATE public.products
    SET
      unit_price = trim(to_char(p_unit_price, 'FM999999999990.00')),
      currency = COALESCE(NULLIF(btrim(COALESCE(p_currency, '')), ''), currency, 'TRY'),
      updated_at = now()
    WHERE id = p_product_id;
  END IF;

  RETURN v_movement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_stock_into_operated_warehouse(text, uuid, numeric, text, text, text, numeric, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_stock_into_operated_warehouse(text, uuid, numeric, text, text, text, numeric, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_stock_into_operated_warehouse(text, uuid, numeric, text, text, text, numeric, text, text) TO authenticated;
