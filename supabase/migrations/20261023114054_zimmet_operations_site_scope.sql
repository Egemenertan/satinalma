-- Geçmiş işlemler yalnızca işlemin gerçekleştiği siteyi görebilsin.

ALTER TABLE public.zimmet_operations
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.sites(id);

CREATE INDEX IF NOT EXISTS zimmet_operations_site_id_idx
  ON public.zimmet_operations (site_id);

COMMENT ON COLUMN public.zimmet_operations.site_id IS
  'İşlemin gerçekleştiği depo / site. Geçmiş işlemler bu siteye göre sınırlanır.';

-- Kapsam satırı tek bir depo adıysa onu kullan.
-- Değilse satırlardaki depo adları tek siteye iniyorsa onu yaz.
WITH scoped AS (
  SELECT
    zo.id,
    btrim(
      regexp_replace(
        COALESCE(zo.snapshot->>'warehouseScopeLine', ''),
        '^(Teslim deposu:|Kaynak depo / site filtresi:)[[:space:]]*',
        ''
      )
    ) AS site_name
  FROM public.zimmet_operations zo
  WHERE COALESCE(zo.snapshot->>'warehouseScopeLine', '') ~ '^(Teslim deposu:|Kaynak depo / site filtresi:)'
),
from_scope AS (
  SELECT DISTINCT ON (sc.id)
    sc.id AS operation_id,
    s.id AS site_id
  FROM scoped sc
  JOIN public.sites s ON s.name = sc.site_name
  WHERE sc.site_name IS NOT NULL
    AND sc.site_name <> ''
  ORDER BY sc.id, s.id
),
row_labels AS (
  SELECT
    zo.id AS operation_id,
    btrim(part) AS site_name
  FROM public.zimmet_operations zo
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(zo.snapshot->'rows', '[]'::jsonb)) AS row(item)
  CROSS JOIN LATERAL unnest(string_to_array(COALESCE(row.item->>'sourceWarehouse', ''), '→')) AS part
  WHERE btrim(part) <> ''
),
from_rows_single AS (
  SELECT
    rl.operation_id,
    (array_agg(DISTINCT s.id))[1] AS site_id
  FROM row_labels rl
  JOIN public.sites s ON s.name = rl.site_name
  GROUP BY rl.operation_id
  HAVING count(DISTINCT s.id) = 1
)
UPDATE public.zimmet_operations zo
SET site_id = COALESCE(fs.site_id, fr.site_id)
FROM public.zimmet_operations src
LEFT JOIN from_scope fs ON fs.operation_id = src.id
LEFT JOIN from_rows_single fr ON fr.operation_id = src.id
WHERE zo.id = src.id
  AND zo.site_id IS NULL
  AND COALESCE(fs.site_id, fr.site_id) IS NOT NULL;

DROP POLICY IF EXISTS "zimmet_operations_select" ON public.zimmet_operations;
CREATE POLICY "zimmet_operations_select"
  ON public.zimmet_operations
  FOR SELECT
  TO authenticated
  USING (
    public.has_warehouse_manage_all()
    OR (
      site_id IS NOT NULL
      AND public.can_access_warehouse(site_id)
    )
  );

DROP POLICY IF EXISTS "zimmet_operations_insert" ON public.zimmet_operations;
CREATE POLICY "zimmet_operations_insert"
  ON public.zimmet_operations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    performed_by = auth.uid()
    AND site_id IS NOT NULL
    AND (
      public.has_warehouse_manage_all()
      OR EXISTS (
        SELECT 1
        FROM public.warehouse_access wa
        WHERE wa.user_id = auth.uid()
          AND wa.warehouse_id = site_id
          AND wa.access_level IN ('manage', 'operate')
      )
    )
  );
