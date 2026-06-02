-- Server-owned incident lifecycle fields.
-- The mobile client should not be responsible for title generation or closure attribution.

CREATE OR REPLACE FUNCTION public.set_incident_lifecycle_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  creator_name text;
  commune_name text;
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  SELECT COALESCE(NULLIF(up.name, ''), split_part(au.email::text, '@', 1), 'Agent terrain')
    INTO creator_name
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON up.id = au.id
  WHERE au.id = NEW.created_by;

  SELECT c.name
    INTO commune_name
  FROM public.communes c
  WHERE c.id = NEW.commune_id;

  NEW.title := concat_ws(
    ' - ',
    COALESCE(NULLIF(NEW.type, ''), 'Incident'),
    COALESCE(creator_name, 'Agent terrain'),
    COALESCE(commune_name, 'Commune inconnue'),
    NULLIF(NEW.village, '')
  );

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'closed' THEN
      NEW.closed_at := COALESCE(NEW.closed_at, now());
      NEW.closed_by := COALESCE(NEW.closed_by, auth.uid());
    ELSE
      NEW.closed_at := NULL;
      NEW.closed_by := NULL;
    END IF;
  ELSE
    IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
      NEW.closed_at := now();
      NEW.closed_by := auth.uid();
    ELSIF NEW.status = 'open' AND OLD.status IS DISTINCT FROM 'open' THEN
      NEW.closed_at := NULL;
      NEW.closed_by := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_incident_lifecycle_fields ON public.incidents;

CREATE TRIGGER set_incident_lifecycle_fields
BEFORE INSERT OR UPDATE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.set_incident_lifecycle_fields();

UPDATE public.incidents i
SET title = generated.title
FROM (
  SELECT
    i.id,
    concat_ws(
      ' - ',
      COALESCE(NULLIF(i.type, ''), 'Incident'),
      COALESCE(NULLIF(up.name, ''), split_part(au.email::text, '@', 1), 'Agent terrain'),
      COALESCE(c.name, 'Commune inconnue'),
      NULLIF(i.village, '')
    ) AS title
  FROM public.incidents i
  LEFT JOIN auth.users au ON au.id = i.created_by
  LEFT JOIN public.user_profiles up ON up.id = i.created_by
  LEFT JOIN public.communes c ON c.id = i.commune_id
) generated
WHERE generated.id = i.id;
