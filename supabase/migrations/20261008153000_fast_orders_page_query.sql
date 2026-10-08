-- Sipariş listesi tek sorguda sayfalansın.
-- Tarayıcı tüm tabloyu indirip grafiği 200'lük parçalarla tekrar çekmesin.

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

CREATE OR REPLACE FUNCTION public.get_orders_page(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 24,
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_site_names text[] DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_today date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_site_ids uuid[];
  v_words text[] := ARRAY[]::text[];
  v_page integer;
  v_limit integer;
  v_today date;
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Kullanıcı oturumu bulunamadı';
  END IF;

  SELECT role::text, COALESCE(site_id, ARRAY[]::uuid[])
  INTO v_role, v_site_ids
  FROM profiles
  WHERE id = v_user;

  IF v_role IS NULL OR v_role NOT IN ('purchasing_officer', 'manager', 'admin') THEN
    RAISE EXCEPTION 'Bu sayfaya erişim yetkiniz yoktur';
  END IF;

  IF v_role = 'purchasing_officer' AND cardinality(v_site_ids) = 0 THEN
    RETURN jsonb_build_object(
      'orders', '[]'::jsonb,
      'totalCount', 0,
      'totalPages', 0,
      'analytics', NULL
    );
  END IF;

  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_limit := LEAST(GREATEST(COALESCE(p_page_size, 24), 1), 100);
  v_today := COALESCE(p_today, CURRENT_DATE);

  IF p_search IS NOT NULL AND btrim(p_search) <> '' THEN
    SELECT COALESCE(array_agg(escaped), ARRAY[]::text[])
    INTO v_words
    FROM (
      SELECT replace(
        replace(
          replace(
            lower(translate(word, 'ıİşŞğĞüÜöÖçÇ', 'iisggguuoocc')),
            E'\\', E'\\\\'
          ),
          '%', E'\\%'
        ),
        '_', E'\\_'
      ) AS escaped
      FROM unnest(regexp_split_to_array(btrim(p_search), '\s+')) AS word
      WHERE word <> ''
    ) words;
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT
      o.id,
      o.created_at,
      (o.created_at AT TIME ZONE 'UTC')::date AS created_day,
      CASE
        WHEN o.status = 'iade edildi' THEN 'returned'
        WHEN o.status = 'delivered' OR COALESCE(o.is_delivered, false) THEN 'delivered'
        WHEN o.status IN ('partially_delivered', 'kısmen teslim alındı') THEN 'partial'
        ELSE 'pending'
      END AS klass,
      CASE
        WHEN upper(COALESCE(o.currency, '')) = 'TRY' THEN COALESCE(o.amount, 0)
        ELSE 0
      END AS try_amount
    FROM orders o
    JOIN purchase_requests pr ON pr.id = o.purchase_request_id
    LEFT JOIN suppliers s ON s.id = o.supplier_id
    LEFT JOIN purchase_request_items pri ON pri.id = o.material_item_id
    WHERE (
      v_role IN ('manager', 'admin')
      OR pr.site_id = ANY (v_site_ids)
    )
    AND (
      p_status IS NULL OR btrim(p_status) = '' OR p_status = 'all' OR o.status = p_status
    )
    AND (p_date_from IS NULL OR o.delivery_date >= p_date_from)
    AND (p_date_to IS NULL OR o.delivery_date <= p_date_to)
    AND (
      p_site_names IS NULL
      OR cardinality(p_site_names) = 0
      OR pr.site_name = ANY (p_site_names)
    )
    AND (
      cardinality(v_words) = 0
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(v_words) AS word
        WHERE lower(translate(concat_ws(
          ' ',
          s.name,
          o.order_number,
          pr.title,
          pr.request_number,
          pri.item_name,
          pri.brand,
          pri.specifications,
          o.quantity::text,
          pri.unit,
          CASE
            WHEN o.quantity IS NOT NULL AND pri.unit IS NOT NULL
            THEN o.quantity::text || ' ' || pri.unit
          END
        ), 'ıİşŞğĞüÜöÖçÇ', 'iisggguuoocc')) NOT LIKE '%' || word || '%' ESCAPE E'\\'
      )
    )
  ),
  stats AS (
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE klass = 'delivered')::int AS delivered,
      count(*) FILTER (WHERE klass = 'partial')::int AS partial,
      count(*) FILTER (WHERE klass = 'returned')::int AS returned
    FROM filtered
  ),
  anchor AS (
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM filtered f
          WHERE f.created_day BETWEEN v_today - 29 AND v_today
        ) THEN v_today
        ELSE COALESCE((SELECT max(created_day) FROM filtered), v_today)
      END AS end_day,
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM filtered) THEN false
        WHEN EXISTS (
          SELECT 1
          FROM filtered f
          WHERE f.created_day BETWEEN v_today - 29 AND v_today
        ) THEN false
        ELSE true
      END AS anchored
  ),
  daily AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'dayKey', to_char(d::date, 'YYYY-MM-DD'),
        'count', COALESCE(c.cnt, 0),
        'amount', COALESCE(c.amt, 0)
      )
      ORDER BY d
    ), '[]'::jsonb) AS payload
    FROM anchor a
    CROSS JOIN generate_series(a.end_day - 29, a.end_day, interval '1 day') AS d
    LEFT JOIN (
      SELECT created_day, count(*)::int AS cnt, COALESCE(sum(try_amount), 0)::float8 AS amt
      FROM filtered
      GROUP BY created_day
    ) c ON c.created_day = d::date
  ),
  page_ids AS (
    SELECT id, created_at
    FROM filtered
    ORDER BY created_at DESC, id DESC
    LIMIT v_limit
    OFFSET (v_page - 1) * v_limit
  ),
  orders_json AS (
    SELECT COALESCE(jsonb_agg(payload ORDER BY sort_at DESC, sort_id DESC), '[]'::jsonb) AS payload
    FROM (
      SELECT
        o.created_at AS sort_at,
        o.id AS sort_id,
        jsonb_build_object(
          'id', o.id,
          'order_number', o.order_number,
          'purchase_request_id', o.purchase_request_id,
          'supplier_id', o.supplier_id,
          'delivery_date', o.delivery_date,
          'amount', o.amount,
          'currency', o.currency,
          'quantity', o.quantity,
          'returned_quantity', o.returned_quantity,
          'return_notes', o.return_notes,
          'is_return_reorder', o.is_return_reorder,
          'status', o.status,
          'is_delivered', o.is_delivered,
          'created_at', o.created_at,
          'material_item_id', o.material_item_id,
          'delivered_at', COALESCE(
            (SELECT max(d.delivered_at) FROM order_deliveries d WHERE d.order_id = o.id),
            o.delivered_at
          ),
          'suppliers', CASE
            WHEN s.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'name', s.name,
              'contact_person', s.contact_person,
              'phone', s.phone,
              'email', s.email
            )
          END,
          'purchase_requests', CASE
            WHEN pr.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'title', pr.title,
              'request_number', pr.request_number,
              'site_name', pr.site_name,
              'status', pr.status
            )
          END,
          'purchase_request_items', CASE
            WHEN pri.id IS NULL THEN NULL
            ELSE jsonb_build_object(
              'item_name', pri.item_name,
              'unit', pri.unit,
              'brand', pri.brand,
              'specifications', pri.specifications
            )
          END,
          'invoices', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', i.id,
              'amount', i.amount,
              'currency', i.currency,
              'invoice_photos', '[]'::jsonb,
              'photo_count', COALESCE(cardinality(i.invoice_photos), 0),
              'photo_key', CASE
                WHEN i.invoice_photos IS NULL OR cardinality(i.invoice_photos) = 0 THEN NULL
                ELSE md5(
                  cardinality(i.invoice_photos)::text
                  || E'\x1e'
                  || array_to_string(i.invoice_photos, E'\x1e')
                )
              END,
              'created_at', i.created_at,
              'parent_invoice_id', i.parent_invoice_id,
              'is_master', i.is_master,
              'subtotal', i.subtotal,
              'discount', i.discount,
              'tax', i.tax,
              'grand_total', i.grand_total,
              'invoice_group_id', i.invoice_group_id,
              'notes', i.notes
            ) ORDER BY i.created_at)
            FROM invoices i
            WHERE i.order_id = o.id
          ), '[]'::jsonb),
          'delivery_image_urls', COALESCE((
            SELECT jsonb_agg(photo ORDER BY sort_at NULLS LAST, sort_id)
            FROM (
              SELECT u.photo, d.delivered_at AS sort_at, d.id AS sort_id
              FROM order_deliveries d
              CROSS JOIN LATERAL unnest(COALESCE(d.delivery_photos, ARRAY[]::text[])) AS u(photo)
              WHERE d.order_id = o.id
                AND u.photo IS NOT NULL
                AND btrim(u.photo) <> ''
            ) photos
          ), '[]'::jsonb)
        ) AS payload
      FROM page_ids p
      JOIN orders o ON o.id = p.id
      LEFT JOIN suppliers s ON s.id = o.supplier_id
      LEFT JOIN purchase_requests pr ON pr.id = o.purchase_request_id
      LEFT JOIN purchase_request_items pri ON pri.id = o.material_item_id
    ) rows
  )
  SELECT jsonb_build_object(
    'orders', orders_json.payload,
    'totalCount', stats.total,
    'totalPages', CASE
      WHEN stats.total = 0 THEN 0
      ELSE CEIL(stats.total::numeric / v_limit)::int
    END,
    'analytics', jsonb_build_object(
      'delivered', stats.delivered,
      'partiallyDelivered', stats.partial,
      'returned', stats.returned,
      'pending', GREATEST(stats.total - stats.delivered - stats.partial - stats.returned, 0),
      'anchored', anchor.anchored,
      'daily', daily.payload
    )
  )
  INTO v_result
  FROM stats
  CROSS JOIN anchor
  CROSS JOIN daily
  CROSS JOIN orders_json;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_orders_page(integer, integer, text, text, text[], date, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_orders_page(integer, integer, text, text, text[], date, date, date) TO authenticated;

COMMENT ON FUNCTION public.get_orders_page(integer, integer, text, text, text[], date, date, date) IS
  'Sipariş sayfası: filtre, sayfalama ve grafik özeti tek sorguda. Fatura fotoğrafı gövdesi dönmez.';
