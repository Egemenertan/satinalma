-- warehouse_access: email kolonu (user_id yanında okunabilir kimlik)

ALTER TABLE public.warehouse_access
  ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.warehouse_access.email IS
  'profiles.email kopyası; tabloda kolay okumak için';

UPDATE public.warehouse_access wa
SET email = p.email
FROM public.profiles p
WHERE wa.user_id = p.id
  AND (wa.email IS NULL OR wa.email = '');

CREATE OR REPLACE FUNCTION public.warehouse_access_set_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    SELECT p.email INTO NEW.email
    FROM public.profiles p
    WHERE p.id = NEW.user_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warehouse_access_set_email ON public.warehouse_access;
CREATE TRIGGER trg_warehouse_access_set_email
  BEFORE INSERT OR UPDATE OF user_id, email
  ON public.warehouse_access
  FOR EACH ROW
  EXECUTE FUNCTION public.warehouse_access_set_email();

CREATE INDEX IF NOT EXISTS warehouse_access_email_idx
  ON public.warehouse_access (email);
