-- Admin commune management for SRM.
-- Communes are reference data for incidents and reports, so deletion is blocked
-- when a commune is already referenced by incident history.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

ALTER TABLE public.communes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communes_authenticated_read ON public.communes;
CREATE POLICY communes_authenticated_read
ON public.communes
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS communes_admin_insert ON public.communes;
CREATE POLICY communes_admin_insert
ON public.communes
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS communes_admin_update ON public.communes;
CREATE POLICY communes_admin_update
ON public.communes
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS communes_admin_delete ON public.communes;
CREATE POLICY communes_admin_delete
ON public.communes
FOR DELETE
TO authenticated
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.get_admin_communes()
RETURNS TABLE (
  id uuid,
  name text,
  incident_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can manage communes.';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    count(i.id)::bigint AS incident_count
  FROM public.communes c
  LEFT JOIN public.incidents i ON i.commune_id = c.id
  GROUP BY c.id, c.name
  ORDER BY c.name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_commune_by_admin(p_name text)
RETURNS TABLE (
  id uuid,
  name text,
  incident_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := trim(p_name);
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can create communes.';
  END IF;

  IF v_name IS NULL OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'Commune name is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('commune-name:' || lower(v_name)));

  IF EXISTS (
    SELECT 1
    FROM public.communes c
    WHERE lower(trim(c.name)) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'Commune already exists: %', v_name;
  END IF;

  INSERT INTO public.communes (name)
  VALUES (v_name)
  RETURNING public.communes.id INTO v_id;

  RETURN QUERY
  SELECT v_id, v_name, 0::bigint;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_commune_by_admin(p_id uuid, p_name text)
RETURNS TABLE (
  id uuid,
  name text,
  incident_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := trim(p_name);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update communes.';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Commune id is required.';
  END IF;

  IF v_name IS NULL OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'Commune name is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('commune-name:' || lower(v_name)));

  IF EXISTS (
    SELECT 1
    FROM public.communes c
    WHERE c.id <> p_id
      AND lower(trim(c.name)) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'Commune already exists: %', v_name;
  END IF;

  UPDATE public.communes c
  SET name = v_name
  WHERE c.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commune not found.';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    count(i.id)::bigint AS incident_count
  FROM public.communes c
  LEFT JOIN public.incidents i ON i.commune_id = c.id
  WHERE c.id = p_id
  GROUP BY c.id, c.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_commune_by_admin(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incident_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete communes.';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Commune id is required.';
  END IF;

  SELECT count(*)::integer
  INTO v_incident_count
  FROM public.incidents
  WHERE commune_id = p_id;

  IF v_incident_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete commune with % linked incident(s). Rename it instead.', v_incident_count;
  END IF;

  DELETE FROM public.communes
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commune not found.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_communes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_commune_by_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_commune_by_admin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_commune_by_admin(uuid) TO authenticated;
