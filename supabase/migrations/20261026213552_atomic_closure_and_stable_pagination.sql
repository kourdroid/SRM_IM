-- Admin material writes and closure must commit together.
CREATE FUNCTION public.close_incident_with_materials(p_incident_id uuid, p_materials jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_incident public.incidents; v_summary text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Approved administrator required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_materials) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Materials must be an array' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_materials)=0 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_materials) item
    WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item->'material_name') IS DISTINCT FROM 'string'
      OR length(btrim(item->>'material_name')) NOT BETWEEN 1 AND 160
      OR jsonb_typeof(item->'client_material_id') IS DISTINCT FROM 'string'
      OR nullif(btrim(item->>'client_material_id'),'') IS NULL
      OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number'
      OR CASE WHEN jsonb_typeof(item->'quantity')='number' THEN (item->>'quantity')::numeric<=0 ELSE true END
  ) THEN RAISE EXCEPTION 'Invalid material row' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_incident FROM public.incidents WHERE id=p_incident_id FOR UPDATE;
  IF NOT FOUND OR v_incident.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Incident unavailable' USING ERRCODE='42501';
  END IF;
  -- A retried successful closure must not edit materials on an already closed incident.
  IF v_incident.status='closed' THEN RETURN p_incident_id; END IF;
  PERFORM public.upsert_incident_materials(p_incident_id,p_materials);
  SELECT string_agg(material_name || ' x' || trim_scale(quantity)::text,'; ' ORDER BY created_at,id)
    INTO v_summary FROM public.incident_materials WHERE incident_id=p_incident_id;
  UPDATE public.incidents SET equipment_used=v_summary,status='closed',updated_at=now()
    WHERE id=p_incident_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident update refused' USING ERRCODE='42501'; END IF;
  RETURN p_incident_id;
END $$;
REVOKE ALL ON FUNCTION public.close_incident_with_materials(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.close_incident_with_materials(uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_director_incidents_page(p_limit integer DEFAULT 20, p_before_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_type text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, title text, type text, date timestamp with time zone, village text, status text, incident_type text, depart_hta text, commune_id uuid, commune_name text, equipment_used text, description text, reclamation boolean, reclamation_name text, reclamation_by text, created_by uuid, created_by_name text, closed_by uuid, closed_by_name text, closed_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, latitude double precision, longitude double precision, media_urls text[], materials_summary text, materials jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin_or_director() THEN
    RAISE EXCEPTION 'Unauthorized: director read access required.';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.title,
    i.type,
    i.date,
    i.village,
    i.status,
    i.incident_type,
    i.depart_hta,
    i.commune_id,
    c.name AS commune_name,
    i.equipment_used,
    i.description,
    i.reclamation,
    i.reclamation_name,
    i.reclamation_by,
    i.created_by,
    creator.name AS created_by_name,
    i.closed_by,
    closer.name AS closed_by_name,
    i.closed_at,
    i.created_at,
    i.updated_at,
    i.latitude,
    i.longitude,
    i.media_urls,
    COALESCE(mat.materials_summary, i.equipment_used, '') AS materials_summary,
    COALESCE(mat.materials, '[]'::jsonb) AS materials
  FROM public.incidents i
  LEFT JOIN public.communes c ON c.id = i.commune_id
  LEFT JOIN public.user_profiles creator ON creator.id = i.created_by
  LEFT JOIN public.user_profiles closer ON closer.id = i.closed_by
  LEFT JOIN LATERAL (
    SELECT
      string_agg(im.material_name || ' x' || trim_scale(im.quantity)::text, '; ' ORDER BY im.created_at, im.id) AS materials_summary,
      jsonb_agg(
        jsonb_build_object(
          'material_name', im.material_name,
          'quantity', im.quantity
        )
        ORDER BY im.created_at, im.id
      ) AS materials
    FROM public.incident_materials im
    WHERE im.incident_id = i.id
  ) mat ON true
  WHERE (p_before_created_at IS NULL OR i.created_at < p_before_created_at OR (p_before_id IS NOT NULL AND i.created_at=p_before_created_at AND i.id<p_before_id))
    AND (p_status IS NULL OR i.status = p_status)
    AND (p_type IS NULL OR i.type = p_type)
    AND (
      p_search IS NULL
      OR i.village ILIKE '%' || p_search || '%'
      OR i.description ILIKE '%' || p_search || '%'
      OR i.equipment_used ILIKE '%' || p_search || '%'
      OR i.depart_hta ILIKE '%' || p_search || '%'
      OR c.name ILIKE '%' || p_search || '%'
      OR EXISTS (
        SELECT 1
        FROM public.incident_materials im_search
        WHERE im_search.incident_id = i.id
          AND im_search.material_name ILIKE '%' || p_search || '%'
      )
    )
  ORDER BY i.created_at DESC, i.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_director_incidents_page(integer,timestamptz,uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_director_incidents_page(integer,timestamptz,uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_incident_report_rows(p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_commune_id uuid DEFAULT NULL::uuid, p_agent_id uuid DEFAULT NULL::uuid, p_type text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_reclamation boolean DEFAULT NULL::boolean, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, title text, type text, status text, incident_type text, depart_hta text, commune_name text, village text, agent_name text, equipment_used text, reclamation boolean, created_at timestamp with time zone, closed_at timestamp with time zone, closure_duration_hours numeric, latitude double precision, longitude double precision, media_count integer, materials_summary text, materials jsonb, description text, reclamation_name text, reclamation_by text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    i.id,
    i.title,
    i.type,
    i.status,
    i.incident_type,
    i.depart_hta,
    c.name AS commune_name,
    i.village,
    up.name AS agent_name,
    i.equipment_used,
    i.reclamation,
    i.created_at,
    i.closed_at,
    CASE
      WHEN i.closed_at IS NULL THEN NULL
      ELSE round((EXTRACT(EPOCH FROM (i.closed_at - i.created_at)) / 3600)::numeric, 2)
    END AS closure_duration_hours,
    i.latitude,
    i.longitude,
    cardinality(COALESCE(i.media_urls, '{}'::text[])) AS media_count,
    COALESCE(mat.materials_summary, i.equipment_used, '') AS materials_summary,
    COALESCE(mat.materials, '[]'::jsonb) AS materials,
    i.description,
    i.reclamation_name,
    i.reclamation_by
  FROM public.incidents i
  LEFT JOIN public.communes c ON c.id = i.commune_id
  LEFT JOIN public.user_profiles up ON up.id = i.created_by
  LEFT JOIN LATERAL (
    SELECT
      string_agg(im.material_name || ' x' || trim_scale(im.quantity)::text, '; ' ORDER BY im.created_at, im.id) AS materials_summary,
      jsonb_agg(
        jsonb_build_object(
          'material_name', im.material_name,
          'quantity', im.quantity
        )
        ORDER BY im.created_at, im.id
      ) AS materials
    FROM public.incident_materials im
    WHERE im.incident_id = i.id
  ) mat ON true
  WHERE i.created_at >= p_start_date
    AND i.created_at < p_end_date
    AND public.is_admin()
    AND (p_commune_id IS NULL OR i.commune_id = p_commune_id)
    AND (p_agent_id IS NULL OR i.created_by = p_agent_id)
    AND (p_type IS NULL OR i.type = p_type)
    AND (p_status IS NULL OR i.status = p_status)
    AND (p_reclamation IS NULL OR i.reclamation = p_reclamation)
  ORDER BY i.created_at DESC, i.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 2000)
  OFFSET GREATEST(p_offset, 0);
$function$;
