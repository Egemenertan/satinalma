-- Ürün araması Türkçe ı/I/İ ve diğer karakterlerde büyük-küçük harf duyarsız olsun.
-- Örnek: tırmık → TIRMIK

CREATE OR REPLACE FUNCTION public.warehouse_scope_product_page(
  p_warehouse_ids uuid[],
  p_include_never_stocked boolean DEFAULT false,
  p_search text DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_brand_id text DEFAULT NULL,
  p_product_type text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(product_id text, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible AS (
    SELECT p.id, p.created_at
    FROM public.products p
    WHERE p.deleted_at IS NULL
      AND (p_is_active IS NULL OR p.is_active = p_is_active)
      AND (p_brand_id IS NULL OR p.brand_id::text = p_brand_id)
      AND (p_product_type IS NULL OR p.product_type = p_product_type)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR public.normalize_search_tr(p.name) LIKE '%' || public.normalize_search_tr(p_search) || '%'
        OR public.normalize_search_tr(coalesce(p.sku, '')) LIKE '%' || public.normalize_search_tr(p_search) || '%'
      )
      AND (
        EXISTS (
          SELECT 1
          FROM public.warehouse_stock ws
          WHERE ws.product_id = p.id
            AND ws.warehouse_id = ANY (p_warehouse_ids)
        )
        OR EXISTS (
          SELECT 1
          FROM public.stock_movements sm
          WHERE sm.product_id = p.id
            AND sm.warehouse_id = ANY (p_warehouse_ids)
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_inventory ui
          WHERE ui.product_id = p.id
            AND ui.source_warehouse_id = ANY (p_warehouse_ids)
            AND ui.status = 'active'
            AND ui.quantity > 0
        )
        OR (
          p_include_never_stocked
          AND NOT EXISTS (
            SELECT 1
            FROM public.warehouse_stock ws
            WHERE ws.product_id = p.id
          )
        )
      )
  )
  SELECT v.id, count(*) OVER()::bigint
  FROM visible v
  ORDER BY v.created_at DESC NULLS LAST
  OFFSET GREATEST(p_offset, 0)
  LIMIT GREATEST(p_limit, 1);
$$;
