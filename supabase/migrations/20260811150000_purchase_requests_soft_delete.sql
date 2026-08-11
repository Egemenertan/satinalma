-- Soft delete for purchase_requests: never hard-delete business data.
-- Lists/UI filter with deleted_at IS NULL.

ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid NULL REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_deleted_at
  ON public.purchase_requests (deleted_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.purchase_requests.deleted_at IS 'Soft delete timestamp; NULL = aktif talep';
COMMENT ON COLUMN public.purchase_requests.deleted_by IS 'Talebi listeden kaldıran kullanıcı';

CREATE OR REPLACE FUNCTION public.prevent_purchase_request_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'purchase_requests hard delete yasak: soft delete kullanın (deleted_at / status=deleted)';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_purchase_request_hard_delete ON public.purchase_requests;
CREATE TRIGGER trg_prevent_purchase_request_hard_delete
  BEFORE DELETE ON public.purchase_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_purchase_request_hard_delete();
