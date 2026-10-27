-- Operate kullanıcısı kendi yaptığı zimmet işlemini her zaman görebilsin.

DROP POLICY IF EXISTS "zimmet_operations_select" ON public.zimmet_operations;
CREATE POLICY "zimmet_operations_select"
  ON public.zimmet_operations
  FOR SELECT
  TO authenticated
  USING (
    performed_by = auth.uid()
    OR public.has_warehouse_manage_all()
    OR (
      site_id IS NOT NULL
      AND public.can_access_warehouse(site_id)
    )
  );
