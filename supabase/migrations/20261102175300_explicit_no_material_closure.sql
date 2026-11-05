ALTER TABLE public.incidents
  ADD COLUMN no_material_used boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.enforce_incident_materials_before_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE has_materials boolean;
BEGIN
  IF NEW.status <> 'closed' THEN
    NEW.no_material_used := false;
    IF TG_OP = 'UPDATE' AND OLD.no_material_used THEN NEW.equipment_used := ''; END IF;
    RETURN NEW;
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.incident_materials WHERE incident_id = NEW.id) INTO has_materials;
  IF NEW.no_material_used THEN
    IF has_materials THEN RAISE EXCEPTION 'Recorded materials cannot be declared as none.'; END IF;
    NEW.equipment_used := 'Aucun matériel utilisé';
  ELSIF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'closed' OR OLD.no_material_used THEN
    IF NOT has_materials THEN
      RAISE EXCEPTION 'Declare materials or explicitly confirm no material used before closing.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER enforce_incident_materials_before_close ON public.incidents;
CREATE TRIGGER enforce_incident_materials_before_close
BEFORE INSERT OR UPDATE OF status, no_material_used, equipment_used ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.enforce_incident_materials_before_close();

-- Serialize material writes against closure so concurrent users cannot record both declarations.
CREATE FUNCTION public.guard_material_usage_declaration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE no_material boolean;
BEGIN
  SELECT no_material_used INTO no_material FROM public.incidents WHERE id = NEW.incident_id FOR UPDATE;
  IF no_material THEN RAISE EXCEPTION 'Reopen the incident before recording materials.'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_material_usage_declaration() FROM PUBLIC, anon;
CREATE TRIGGER guard_material_usage_declaration BEFORE INSERT OR UPDATE ON public.incident_materials
FOR EACH ROW EXECUTE FUNCTION public.guard_material_usage_declaration();

CREATE FUNCTION public.close_incident_with_materials(p_incident_id uuid, p_materials jsonb, p_no_material_used boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_incident public.incidents; v_summary text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Approved administrator required' USING ERRCODE='42501';
  END IF;
  IF p_no_material_used IS NULL OR jsonb_typeof(p_materials) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Explicit material declaration required' USING ERRCODE='22023';
  END IF;
  IF (p_no_material_used AND jsonb_array_length(p_materials) <> 0)
    OR (NOT p_no_material_used AND jsonb_array_length(p_materials) = 0)
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_materials) item
      WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
        OR jsonb_typeof(item->'material_name') IS DISTINCT FROM 'string'
        OR length(btrim(item->>'material_name')) NOT BETWEEN 1 AND 160
        OR jsonb_typeof(item->'client_material_id') IS DISTINCT FROM 'string'
        OR nullif(btrim(item->>'client_material_id'),'') IS NULL
        OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number'
        OR CASE WHEN jsonb_typeof(item->'quantity')='number' THEN (item->>'quantity')::numeric <= 0 ELSE true END
    ) THEN RAISE EXCEPTION 'Invalid material declaration' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_incident FROM public.incidents WHERE id=p_incident_id FOR UPDATE;
  IF NOT FOUND OR v_incident.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Incident unavailable' USING ERRCODE='42501';
  END IF;
  IF v_incident.status='closed' THEN
    IF v_incident.no_material_used IS DISTINCT FROM p_no_material_used THEN
      RAISE EXCEPTION 'Incident already closed with a different material declaration';
    END IF;
    RETURN p_incident_id;
  END IF;
  IF NOT p_no_material_used THEN PERFORM public.upsert_incident_materials(p_incident_id,p_materials); END IF;
  SELECT string_agg(material_name || ' x' || trim_scale(quantity)::text,'; ' ORDER BY created_at,id)
    INTO v_summary FROM public.incident_materials WHERE incident_id=p_incident_id;
  UPDATE public.incidents SET equipment_used=COALESCE(v_summary,''), no_material_used=p_no_material_used,
    status='closed',updated_at=now() WHERE id=p_incident_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident update refused' USING ERRCODE='42501'; END IF;
  RETURN p_incident_id;
END $$;
REVOKE ALL ON FUNCTION public.close_incident_with_materials(uuid,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.close_incident_with_materials(uuid,jsonb,boolean) TO authenticated;

-- Keep installed clients using the existing two-argument RPC working.
CREATE OR REPLACE FUNCTION public.close_incident_with_materials(p_incident_id uuid, p_materials jsonb)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT public.close_incident_with_materials(p_incident_id, p_materials, false);
$$;
