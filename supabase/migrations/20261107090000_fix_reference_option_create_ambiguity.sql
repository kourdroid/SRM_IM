-- RETURNS TABLE columns are PL/pgSQL variables, so an unqualified sort_order or network_type in a
-- query is ambiguous and every create call failed. Only the sort order lookups change here.
CREATE OR REPLACE FUNCTION public.create_incident_type_option_by_admin(
  p_network_type text,
  p_name text
)
RETURNS TABLE (
  id uuid,
  network_type text,
  name text,
  active boolean,
  sort_order integer,
  incident_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_network_type text := upper(trim(p_network_type));
  v_name text := trim(p_name);
  v_sort_order integer;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can create incident types.';
  END IF;

  IF v_network_type NOT IN ('BT', 'MT') THEN
    RAISE EXCEPTION 'Network type must be BT or MT.';
  END IF;
  IF v_name IS NULL OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'Incident type name is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('incident-type:' || v_network_type || ':' || lower(v_name)));

  IF EXISTS (
    SELECT 1 FROM public.incident_type_options o
    WHERE o.network_type = v_network_type
      AND lower(trim(o.name)) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'Incident type already exists: %', v_name;
  END IF;

  SELECT COALESCE(max(o.sort_order), 0) + 10
  INTO v_sort_order
  FROM public.incident_type_options o
  WHERE o.network_type = v_network_type;

  INSERT INTO public.incident_type_options (network_type, name, sort_order)
  VALUES (v_network_type, v_name, v_sort_order)
  RETURNING public.incident_type_options.id INTO v_id;

  RETURN QUERY
  SELECT v_id, v_network_type, v_name, true, v_sort_order, 0::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.create_incident_type_option_by_admin(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_incident_type_option_by_admin(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_depart_hta_option_by_admin(p_name text)
RETURNS TABLE (
  id uuid,
  name text,
  active boolean,
  sort_order integer,
  incident_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := trim(p_name);
  v_sort_order integer;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can create Départs HTA.';
  END IF;
  IF v_name IS NULL OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'Départ HTA name is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('depart-hta:' || lower(v_name)));

  IF EXISTS (
    SELECT 1 FROM public.depart_hta_options o
    WHERE lower(trim(o.name)) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'Départ HTA already exists: %', v_name;
  END IF;

  SELECT COALESCE(max(o.sort_order), 0) + 10 INTO v_sort_order FROM public.depart_hta_options o;

  INSERT INTO public.depart_hta_options (name, sort_order)
  VALUES (v_name, v_sort_order)
  RETURNING public.depart_hta_options.id INTO v_id;

  RETURN QUERY
  SELECT v_id, v_name, true, v_sort_order, 0::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.create_depart_hta_option_by_admin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_depart_hta_option_by_admin(text) TO authenticated;
