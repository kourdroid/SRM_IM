-- Allow admins to rename an incident type that is already used. Incidents reference their type by
-- name (incidents.incident_type), so a rename also rewrites the matching incidents (archived ones
-- included) to keep counts and reports consistent. The network (BT/MT) of a used type stays fixed.
CREATE OR REPLACE FUNCTION public.update_incident_type_option_by_admin(
  p_id uuid, p_network_type text, p_name text, p_active boolean, p_sort_order integer)
RETURNS TABLE(id uuid, network_type text, name text, active boolean, sort_order integer, incident_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_network_type text := upper(trim(p_network_type));
  v_name text := trim(p_name);
  v_old public.incident_type_options%ROWTYPE;
  v_incident_count bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update incident types.';
  END IF;
  IF p_id IS NULL THEN RAISE EXCEPTION 'Incident type id is required.'; END IF;
  IF v_network_type NOT IN ('BT', 'MT') THEN RAISE EXCEPTION 'Network type must be BT or MT.'; END IF;
  IF v_name IS NULL OR length(v_name) < 2 THEN RAISE EXCEPTION 'Incident type name is required.'; END IF;

  SELECT * INTO v_old FROM public.incident_type_options o WHERE o.id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident type not found.'; END IF;

  SELECT count(*) INTO v_incident_count FROM public.incidents i
  WHERE i.type = v_old.network_type AND lower(trim(i.incident_type)) = lower(trim(v_old.name));

  IF v_incident_count > 0 AND v_network_type <> v_old.network_type THEN
    RAISE EXCEPTION 'The network of a used incident type cannot be changed.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.incident_type_options o
    WHERE o.id <> p_id AND o.network_type = v_network_type AND lower(trim(o.name)) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'Incident type already exists: %', v_name;
  END IF;

  UPDATE public.incident_type_options o
  SET network_type = v_network_type, name = v_name,
      active = COALESCE(p_active, o.active), sort_order = COALESCE(p_sort_order, o.sort_order),
      updated_at = now()
  WHERE o.id = p_id;

  IF v_incident_count > 0 AND trim(v_old.name) <> v_name THEN
    UPDATE public.incidents i SET incident_type = v_name
    WHERE i.type = v_old.network_type AND lower(trim(i.incident_type)) = lower(trim(v_old.name));
  END IF;

  RETURN QUERY
  SELECT item.id, item.network_type, item.name, item.active, item.sort_order, item.incident_count
  FROM public.get_admin_incident_type_options() item WHERE item.id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_incident_type_option_by_admin(uuid, text, text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_incident_type_option_by_admin(uuid, text, text, boolean, integer) TO authenticated;
