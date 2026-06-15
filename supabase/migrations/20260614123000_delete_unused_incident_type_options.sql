-- Allow administrators to delete incident type options only when no incident history uses them.

CREATE OR REPLACE FUNCTION public.delete_incident_type_option_by_admin(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_network_type text;
  v_name text;
  v_incident_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete incident types.';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Incident type id is required.';
  END IF;

  SELECT o.network_type, o.name
  INTO v_network_type, v_name
  FROM public.incident_type_options o
  WHERE o.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident type not found.';
  END IF;

  SELECT count(*)::integer
  INTO v_incident_count
  FROM public.incidents i
  WHERE i.type = v_network_type
    AND lower(trim(i.incident_type)) = lower(trim(v_name));

  IF v_incident_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete incident type with % linked incident(s). Deactivate it instead.', v_incident_count;
  END IF;

  DELETE FROM public.incident_type_options
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_incident_type_option_by_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_incident_type_option_by_admin(uuid) TO authenticated;
