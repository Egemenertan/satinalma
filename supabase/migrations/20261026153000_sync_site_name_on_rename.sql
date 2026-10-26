-- Şantiye/depo adı değişince purchase_requests ve offers üzerindeki kopya site_name
-- eski değerde kalıyordu. Bundan sonra sites.name güncellenince senkronize edilir.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.auto_populate_site_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.site_id IS NOT NULL THEN
    SELECT name INTO NEW.site_name
    FROM public.sites
    WHERE id = NEW.site_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_denormalized_site_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name THEN
    RETURN NEW;
  END IF;

  UPDATE public.purchase_requests
  SET site_name = NEW.name
  WHERE site_id = NEW.id
    AND site_name IS DISTINCT FROM NEW.name;

  UPDATE public.offers
  SET site_name = NEW.name
  WHERE site_id = NEW.id
    AND site_name IS DISTINCT FROM NEW.name;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_denormalized_site_names() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_denormalized_site_names() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_denormalized_site_names ON public.sites;

CREATE TRIGGER trg_sync_denormalized_site_names
AFTER UPDATE OF name ON public.sites
FOR EACH ROW
EXECUTE FUNCTION private.sync_denormalized_site_names();

UPDATE public.purchase_requests AS pr
SET site_name = s.name
FROM public.sites AS s
WHERE pr.site_id = s.id
  AND pr.site_name IS DISTINCT FROM s.name;

UPDATE public.offers AS o
SET site_name = s.name
FROM public.sites AS s
WHERE o.site_id = s.id
  AND o.site_name IS DISTINCT FROM s.name;
