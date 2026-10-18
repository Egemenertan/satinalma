-- Sözleşmede olmayan tedarikçi taleplerini isteğe bağlı dahil etmek için.

CREATE TABLE IF NOT EXISTS public.supplier_contract_inclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.supplier_contracts(id) ON DELETE CASCADE,
  request_key text NOT NULL,
  item_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, request_key)
);

CREATE INDEX IF NOT EXISTS supplier_contract_inclusions_contract_id_idx
  ON public.supplier_contract_inclusions (contract_id);

ALTER TABLE public.supplier_contract_inclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_contract_inclusions_select ON public.supplier_contract_inclusions;
CREATE POLICY supplier_contract_inclusions_select
  ON public.supplier_contract_inclusions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS supplier_contract_inclusions_insert ON public.supplier_contract_inclusions;
CREATE POLICY supplier_contract_inclusions_insert
  ON public.supplier_contract_inclusions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_contract_manager());

DROP POLICY IF EXISTS supplier_contract_inclusions_delete ON public.supplier_contract_inclusions;
CREATE POLICY supplier_contract_inclusions_delete
  ON public.supplier_contract_inclusions
  FOR DELETE
  TO authenticated
  USING (public.is_contract_manager());

GRANT SELECT, INSERT, DELETE ON public.supplier_contract_inclusions TO authenticated;
