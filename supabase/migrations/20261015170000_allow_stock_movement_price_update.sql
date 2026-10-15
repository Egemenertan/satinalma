-- Alım geçmişindeki birim fiyat düzeltilebilsin.
-- Güncelleme, ürün kartındaki fiyatı son girişe göre yeniden yazar.

DROP POLICY IF EXISTS "stock_movements_update_by_access" ON public.stock_movements;
CREATE POLICY "stock_movements_update_by_access"
  ON public.stock_movements
  FOR UPDATE
  TO authenticated
  USING (
    public.user_role_cannot_write()
    AND public.can_access_warehouse(warehouse_id)
  )
  WITH CHECK (
    public.user_role_cannot_write()
    AND public.can_access_warehouse(warehouse_id)
  );

CREATE OR REPLACE FUNCTION private.sync_product_unit_price_from_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_product uuid;
BEGIN
  target_product := COALESCE(NEW.product_id, OLD.product_id);
  IF target_product IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.products AS p
  SET
    unit_price = trim(to_char(latest.unit_price, 'FM999999999990.00')),
    currency = COALESCE(NULLIF(btrim(latest.currency), ''), p.currency, 'TRY'),
    updated_at = now()
  FROM (
    SELECT unit_price, currency
    FROM public.stock_movements
    WHERE product_id = target_product
      AND movement_type = 'giriş'
      AND unit_price IS NOT NULL
      AND unit_price > 0
    ORDER BY created_at DESC
    LIMIT 1
  ) AS latest
  WHERE p.id = target_product;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_movements_sync_product_unit_price ON public.stock_movements;

CREATE TRIGGER stock_movements_sync_product_unit_price
AFTER INSERT OR UPDATE OF unit_price, currency, movement_type, product_id
ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION private.sync_product_unit_price_from_inbound();
