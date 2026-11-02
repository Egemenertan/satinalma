-- Operate / depo yönetici ürün görselini storage'a yükleyebiliyor, products.images
-- güncellemesi manage-all RLS yüzünden sessizce 0 satır dönüyordu.

CREATE OR REPLACE FUNCTION public.can_write_product_catalog_media()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_warehouse_manage_all()
    OR EXISTS (
      SELECT 1
      FROM public.warehouse_access wa
      WHERE wa.user_id = auth.uid()
        AND wa.access_level IN ('manage', 'operate')
        AND wa.warehouse_id IS NOT NULL
    );
$$;

REVOKE ALL ON FUNCTION public.can_write_product_catalog_media() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_write_product_catalog_media() FROM anon;
GRANT EXECUTE ON FUNCTION public.can_write_product_catalog_media() TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_storage_write_access()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.can_write_product_catalog_media() THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'::public.user_role_enum
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = ANY (
        ARRAY[
          'site_personnel'::public.user_role_enum,
          'site_manager'::public.user_role_enum,
          'purchasing_officer'::public.user_role_enum,
          'warehouse_manager'::public.user_role_enum,
          'santiye_depo'::public.user_role_enum,
          'santiye_depo_siparis'::public.user_role_enum,
          'santiye_depo_yonetici'::public.user_role_enum,
          'manager'::public.user_role_enum,
          'department_head'::public.user_role_enum,
          'depomanager'::public.user_role_enum
        ]
      )
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_product_images(
  p_product_id text,
  p_images text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_images jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Oturum bulunamadı';
  END IF;

  IF p_product_id IS NULL OR btrim(p_product_id) = '' THEN
    RAISE EXCEPTION 'Ürün seçin';
  END IF;

  IF NOT public.can_write_product_catalog_media() THEN
    RAISE EXCEPTION 'Görsel kaydetme yetkiniz yok';
  END IF;

  UPDATE public.products
  SET
    images = to_jsonb(COALESCE(p_images, ARRAY[]::text[])),
    updated_at = now()
  WHERE id = p_product_id
    AND deleted_at IS NULL
  RETURNING images INTO v_images;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ürün bulunamadı';
  END IF;

  RETURN COALESCE(v_images, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.save_product_images(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_product_images(text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_product_images(text, text[]) TO authenticated;
