-- stock_movements.product_id ve products.id text; tetikleyici uuid kullanınca teslim patlıyordu.

CREATE OR REPLACE FUNCTION private.sync_product_unit_price_from_inbound()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_product text;
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
