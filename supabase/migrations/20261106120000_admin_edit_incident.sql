-- Admins can correct an incident's descriptive fields whether it is open or closed. Status, network
-- (BT/MT), author, date, GPS, photos and materials are untouched. Every edit is logged in incident_events.
CREATE OR REPLACE FUNCTION public.update_incident_by_admin(
  p_incident_id uuid,
  p_incident_type text,
  p_depart_hta text,
  p_commune_id uuid,
  p_village text,
  p_description text,
  p_reclamation boolean,
  p_reclamation_name text,
  p_reclamation_by text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_old public.incidents%ROWTYPE;
  v_type text;
  v_depart text;
  v_village text := trim(COALESCE(p_village, ''));
  v_description text := NULLIF(trim(COALESCE(p_description, '')), '');
  v_recl boolean := COALESCE(p_reclamation, false);
  v_recl_name text := NULLIF(trim(COALESCE(p_reclamation_name, '')), '');
  v_recl_by text := NULLIF(trim(COALESCE(p_reclamation_by, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Approved admin required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_old FROM public.incidents WHERE id = p_incident_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found' USING ERRCODE = 'P0002'; END IF;

  IF v_village = '' THEN RAISE EXCEPTION 'Le village est requis.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.communes WHERE id = p_commune_id) THEN
    RAISE EXCEPTION 'Commune introuvable.';
  END IF;

  SELECT o.name INTO v_type FROM public.incident_type_options o
  WHERE o.network_type = v_old.type AND lower(trim(o.name)) = lower(trim(COALESCE(p_incident_type, '')));
  IF v_type IS NULL AND lower(trim(COALESCE(p_incident_type, ''))) = lower(trim(COALESCE(v_old.incident_type, ''))) THEN
    v_type := v_old.incident_type;
  END IF;
  IF v_type IS NULL THEN RAISE EXCEPTION 'Type d''incident invalide pour le réseau %.', v_old.type; END IF;

  IF v_old.type = 'MT' THEN
    SELECT d.name INTO v_depart FROM public.depart_hta_options d
    WHERE lower(trim(d.name)) = lower(trim(COALESCE(p_depart_hta, '')));
    IF v_depart IS NULL AND lower(trim(COALESCE(p_depart_hta, ''))) = lower(trim(COALESCE(v_old.depart_hta, ''))) THEN
      v_depart := v_old.depart_hta;
    END IF;
    IF v_depart IS NULL THEN RAISE EXCEPTION 'Le départ HTA est requis pour un incident MT.'; END IF;
  END IF;

  IF NOT v_recl THEN v_recl_name := NULL; v_recl_by := NULL; END IF;

  UPDATE public.incidents SET
    incident_type = v_type,
    depart_hta = v_depart,
    commune_id = p_commune_id,
    village = v_village,
    description = v_description,
    reclamation = v_recl,
    reclamation_name = v_recl_name,
    reclamation_by = v_recl_by,
    updated_at = now()
  WHERE id = p_incident_id;

  INSERT INTO public.incident_events (incident_id, event_type, actor_id, source, client_event_id, old_values, new_values)
  VALUES (
    p_incident_id, 'admin_edited', auth.uid(), 'admin_app',
    'edit:' || p_incident_id::text || ':' || extract(epoch from clock_timestamp())::text,
    jsonb_build_object('incident_type', v_old.incident_type, 'depart_hta', v_old.depart_hta, 'commune_id', v_old.commune_id,
      'village', v_old.village, 'description', v_old.description, 'reclamation', v_old.reclamation,
      'reclamation_name', v_old.reclamation_name, 'reclamation_by', v_old.reclamation_by),
    jsonb_build_object('incident_type', v_type, 'depart_hta', v_depart, 'commune_id', p_commune_id,
      'village', v_village, 'description', v_description, 'reclamation', v_recl,
      'reclamation_name', v_recl_name, 'reclamation_by', v_recl_by)
  );

  RETURN p_incident_id;
END $$;

REVOKE ALL ON FUNCTION public.update_incident_by_admin(uuid, text, text, uuid, text, text, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_incident_by_admin(uuid, text, text, uuid, text, text, boolean, text, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
