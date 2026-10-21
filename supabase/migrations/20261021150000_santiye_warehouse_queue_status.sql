-- Şantiye depo talebi "beklemede" iken depo gönderimi statusü güncelleyebilsin.
-- Sıfır adetlik "depoda yok" kaydı da aynı transaction içinde "depoda mevcut değil"e iner.

CREATE OR REPLACE FUNCTION public.shipment_may_rewrite_request_status(current_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(coalesce(current_status, '')) IN (
    'pending',
    'onay_bekliyor',
    'awaiting_offers',
    'kısmen gönderildi',
    'depoda mevcut değil',
    'ana depoda yok',
    'bekliyor',
    'beklemede'
  );
$$;

REVOKE ALL ON FUNCTION public.shipment_may_rewrite_request_status(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shipment_may_rewrite_request_status(text) TO authenticated;
