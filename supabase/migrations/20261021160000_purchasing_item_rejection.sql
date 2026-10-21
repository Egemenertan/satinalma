-- Satın alma sorumlusunun malzeme bazında red nedeni tutması.
ALTER TABLE public.purchase_request_items
  ADD COLUMN IF NOT EXISTS purchasing_rejection_reason text,
  ADD COLUMN IF NOT EXISTS purchasing_rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS purchasing_rejected_by uuid;

COMMENT ON COLUMN public.purchase_request_items.purchasing_rejection_reason IS
  'Satın alma sorumlusunun bu kalem için yazdığı red nedeni.';
