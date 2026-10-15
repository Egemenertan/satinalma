-- Stok girişindeki birim fiyat yalnızca stock_movements'ta kalıyordu.
-- Ürün kartındaki products.unit_price boş olduğu için ekranda "-" görünüyordu.
-- Yeni girişler ürün fiyatını günceller; fiyatı boş ürünler son alımdan doldurulur.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE OR REPLACE FUNCTION private.sync_product_unit_price_from_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.movement_type = 'giriş'
     AND NEW.product_id IS NOT NULL
     AND NEW.unit_price IS NOT NULL
     AND NEW.unit_price > 0 THEN
    UPDATE public.products
    SET
      unit_price = trim(to_char(NEW.unit_price, 'FM999999999990.00')),
      currency = COALESCE(NULLIF(btrim(NEW.currency), ''), currency, 'TRY'),
      updated_at = now()
    WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_product_unit_price_from_inbound() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_product_unit_price_from_inbound() FROM anon, authenticated;

DROP TRIGGER IF EXISTS stock_movements_sync_product_unit_price ON public.stock_movements;

CREATE TRIGGER stock_movements_sync_product_unit_price
AFTER INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION private.sync_product_unit_price_from_inbound();

UPDATE public.products AS p
SET
  unit_price = trim(to_char(latest.unit_price, 'FM999999999990.00')),
  currency = COALESCE(NULLIF(btrim(latest.currency), ''), p.currency, 'TRY'),
  updated_at = now()
FROM (
  SELECT DISTINCT ON (product_id)
    product_id,
    unit_price,
    currency
  FROM public.stock_movements
  WHERE movement_type = 'giriş'
    AND unit_price IS NOT NULL
    AND unit_price > 0
  ORDER BY product_id, created_at DESC
) AS latest
WHERE p.id = latest.product_id
  AND (
    p.unit_price IS NULL
    OR btrim(p.unit_price) = ''
    OR btrim(p.unit_price) IN ('0', '0.0', '0.00')
  );
