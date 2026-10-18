-- İşlemler menüsünden yapılan zimmet işlemlerinin tutanak geçmişi.

CREATE TABLE IF NOT EXISTS public.zimmet_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type text NOT NULL CHECK (operation_type IN ('termination', 'report')),
  person_name text NOT NULL,
  person_email text,
  performed_by uuid REFERENCES public.profiles(id),
  performed_by_name text,
  item_count integer NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS zimmet_operations_created_at_idx
  ON public.zimmet_operations (created_at DESC);

ALTER TABLE public.zimmet_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zimmet_operations_select" ON public.zimmet_operations;
CREATE POLICY "zimmet_operations_select"
  ON public.zimmet_operations
  FOR SELECT
  TO authenticated
  USING (
    public.has_warehouse_manage_all()
    OR EXISTS (
      SELECT 1
      FROM public.warehouse_access wa
      WHERE wa.user_id = auth.uid()
        AND wa.access_level = 'manage'
    )
  );

DROP POLICY IF EXISTS "zimmet_operations_insert" ON public.zimmet_operations;
CREATE POLICY "zimmet_operations_insert"
  ON public.zimmet_operations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    performed_by = auth.uid()
    AND (
      public.has_warehouse_manage_all()
      OR EXISTS (
        SELECT 1
        FROM public.warehouse_access wa
        WHERE wa.user_id = auth.uid()
          AND wa.access_level = 'manage'
      )
    )
  );

GRANT SELECT, INSERT ON public.zimmet_operations TO authenticated;

