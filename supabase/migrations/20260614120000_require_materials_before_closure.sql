-- Enforce the operational rule that an incident cannot be closed until
-- normalized material usage has been recorded.

CREATE OR REPLACE FUNCTION public.enforce_incident_materials_before_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'closed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'closed') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.incident_materials im
      WHERE im.incident_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Materials are required before closing an incident.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_incident_materials_before_close ON public.incidents;
CREATE TRIGGER enforce_incident_materials_before_close
BEFORE INSERT OR UPDATE OF status ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.enforce_incident_materials_before_close();
