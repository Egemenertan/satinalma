-- Depo erişim katmanı (ürün/stok sayfaları)
-- Talep rolleri değişmez; görünürlük warehouse_access üzerinden yönetilir.

CREATE TABLE IF NOT EXISTS public.warehouse_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- NULL = tüm depolar
  warehouse_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  access_level text NOT NULL CHECK (access_level IN ('view', 'manage')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_access_all_requires_manage CHECK (
    warehouse_id IS NOT NULL OR access_level = 'manage'
  )
);

COMMENT ON TABLE public.warehouse_access IS
  'Ürün/stok sayfaları için depo yetkisi. Talep rolleri bundan bağımsızdır.';
COMMENT ON COLUMN public.warehouse_access.warehouse_id IS
  'NULL = tüm depolar (yalnız access_level=manage)';

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_access_user_all_uidx
  ON public.warehouse_access (user_id)
  WHERE warehouse_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_access_user_warehouse_uidx
  ON public.warehouse_access (user_id, warehouse_id)
  WHERE warehouse_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS warehouse_access_user_id_idx
  ON public.warehouse_access (user_id);

CREATE INDEX IF NOT EXISTS warehouse_access_warehouse_id_idx
  ON public.warehouse_access (warehouse_id);

ALTER TABLE public.warehouse_access ENABLE ROW LEVEL SECURITY;

-- Güvenli helper'lar (RLS bypass; search_path sabit)
CREATE OR REPLACE FUNCTION public.has_warehouse_manage_all()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin'::user_role_enum, 'manager'::user_role_enum)
  )
  OR EXISTS (
    SELECT 1
    FROM public.warehouse_access
    WHERE user_id = auth.uid()
      AND warehouse_id IS NULL
      AND access_level = 'manage'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_warehouse(p_warehouse_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_warehouse_manage_all()
    OR (
      p_warehouse_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.warehouse_access
        WHERE user_id = auth.uid()
          AND warehouse_id = p_warehouse_id
          AND access_level IN ('view', 'manage')
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_products()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_warehouse_manage_all();
$$;

GRANT EXECUTE ON FUNCTION public.has_warehouse_manage_all() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_warehouse(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_products() TO authenticated;

-- warehouse_access RLS
DROP POLICY IF EXISTS "warehouse_access_select" ON public.warehouse_access;
CREATE POLICY "warehouse_access_select"
  ON public.warehouse_access
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_warehouse_manage_all()
  );

DROP POLICY IF EXISTS "warehouse_access_insert" ON public.warehouse_access;
CREATE POLICY "warehouse_access_insert"
  ON public.warehouse_access
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_warehouse_manage_all());

DROP POLICY IF EXISTS "warehouse_access_update" ON public.warehouse_access;
CREATE POLICY "warehouse_access_update"
  ON public.warehouse_access
  FOR UPDATE
  TO authenticated
  USING (public.has_warehouse_manage_all())
  WITH CHECK (public.has_warehouse_manage_all());

DROP POLICY IF EXISTS "warehouse_access_delete" ON public.warehouse_access;
CREATE POLICY "warehouse_access_delete"
  ON public.warehouse_access
  FOR DELETE
  TO authenticated
  USING (public.has_warehouse_manage_all());

-- products: SELECT açık kalır (katalog); yazma yalnız manage-all
DROP POLICY IF EXISTS "Authorized roles can manage products" ON public.products;
CREATE POLICY "Manage-all can write products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (public.user_role_cannot_write() AND public.can_manage_products())
  WITH CHECK (public.user_role_cannot_write() AND public.can_manage_products());

-- warehouse_stock: depo bazlı görünürlük + kendi deposunda yazma
DROP POLICY IF EXISTS "Herkes stok bilgilerini görüntüleyebilir" ON public.warehouse_stock;
DROP POLICY IF EXISTS "Authorized roles can insert warehouse stock" ON public.warehouse_stock;
DROP POLICY IF EXISTS "Authorized roles can update warehouse stock" ON public.warehouse_stock;

CREATE POLICY "warehouse_stock_select_by_access"
  ON public.warehouse_stock
  FOR SELECT
  TO authenticated
  USING (public.can_access_warehouse(warehouse_id));

CREATE POLICY "warehouse_stock_insert_by_access"
  ON public.warehouse_stock
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_role_cannot_write()
    AND public.can_access_warehouse(warehouse_id)
  );

CREATE POLICY "warehouse_stock_update_by_access"
  ON public.warehouse_stock
  FOR UPDATE
  TO authenticated
  USING (
    public.user_role_cannot_write()
    AND public.can_access_warehouse(warehouse_id)
  )
  WITH CHECK (
    public.user_role_cannot_write()
    AND public.can_access_warehouse(warehouse_id)
  );

CREATE POLICY "warehouse_stock_delete_by_access"
  ON public.warehouse_stock
  FOR DELETE
  TO authenticated
  USING (
    public.user_role_cannot_write()
    AND public.can_access_warehouse(warehouse_id)
  );

-- stock_movements: aynı erişim modeli
DROP POLICY IF EXISTS "Herkes stok hareketlerini görüntüleyebilir" ON public.stock_movements;
DROP POLICY IF EXISTS "Authorized roles can insert stock movements" ON public.stock_movements;

CREATE POLICY "stock_movements_select_by_access"
  ON public.stock_movements
  FOR SELECT
  TO authenticated
  USING (public.can_access_warehouse(warehouse_id));

CREATE POLICY "stock_movements_insert_by_access"
  ON public.stock_movements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_role_cannot_write()
    AND public.can_access_warehouse(warehouse_id)
  );

-- Seed: mevcut rollerden başlangıç atamaları (talep rolleri aynı kalır)
INSERT INTO public.warehouse_access (user_id, warehouse_id, access_level)
SELECT p.id, NULL, 'manage'
FROM public.profiles p
WHERE p.role IN (
  'admin'::user_role_enum,
  'manager'::user_role_enum,
  'warehouse_manager'::user_role_enum
)
AND NOT EXISTS (
  SELECT 1
  FROM public.warehouse_access wa
  WHERE wa.user_id = p.id
    AND wa.warehouse_id IS NULL
);

INSERT INTO public.warehouse_access (user_id, warehouse_id, access_level)
SELECT p.id, site_uuid, 'view'
FROM public.profiles p
CROSS JOIN LATERAL unnest(COALESCE(p.site_id, ARRAY[]::uuid[])) AS site_uuid
WHERE p.role IN (
  'santiye_depo'::user_role_enum,
  'santiye_depo_yonetici'::user_role_enum,
  'purchasing_officer'::user_role_enum
)
AND site_uuid IS NOT NULL
AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_uuid)
AND NOT EXISTS (
  SELECT 1
  FROM public.warehouse_access wa
  WHERE wa.user_id = p.id
    AND wa.warehouse_id = site_uuid
)
-- manage-all zaten varsa site satırı ekleme
AND NOT EXISTS (
  SELECT 1
  FROM public.warehouse_access wa
  WHERE wa.user_id = p.id
    AND wa.warehouse_id IS NULL
    AND wa.access_level = 'manage'
);
