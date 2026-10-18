-- Teslim raporu da işlem geçmişinde tutulsun.

ALTER TABLE public.zimmet_operations DROP CONSTRAINT IF EXISTS zimmet_operations_operation_type_check;
ALTER TABLE public.zimmet_operations
  ADD CONSTRAINT zimmet_operations_operation_type_check
  CHECK (operation_type IN ('termination', 'report', 'delivery'));
