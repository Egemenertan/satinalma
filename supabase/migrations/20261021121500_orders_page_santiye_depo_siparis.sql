-- Şantiye Depo (Sipariş) rolü, kendi site_id'lerindeki siparişleri görür.

DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_functiondef('public.get_orders_page(integer, integer, text, text, text[], date, date, date)'::regprocedure)
  INTO def;

  def := replace(
    def,
    'v_role NOT IN (''purchasing_officer'', ''manager'', ''admin'')',
    'v_role NOT IN (''purchasing_officer'', ''manager'', ''admin'', ''santiye_depo_siparis'')'
  );

  def := replace(
    def,
    'IF v_role = ''purchasing_officer'' AND cardinality(v_site_ids) = 0 THEN',
    'IF v_role IN (''purchasing_officer'', ''santiye_depo_siparis'') AND cardinality(v_site_ids) = 0 THEN'
  );

  EXECUTE def;
END $$;
