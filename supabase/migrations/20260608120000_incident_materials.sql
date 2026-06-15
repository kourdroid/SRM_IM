-- Normalize incident materials for reliable annual reporting while keeping incidents.equipment_used as a legacy summary.

CREATE TABLE IF NOT EXISTS public.incident_materials (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  client_material_id text NOT NULL,
  material_name text NOT NULL CHECK (length(btrim(material_name)) > 0),
  quantity numeric NOT NULL CHECK (quantity > 0),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT incident_materials_incident_client_material_key UNIQUE (incident_id, client_material_id)
);

CREATE INDEX IF NOT EXISTS idx_incident_materials_incident_id
  ON public.incident_materials (incident_id);

CREATE INDEX IF NOT EXISTS idx_incident_materials_material_name
  ON public.incident_materials (material_name);

CREATE INDEX IF NOT EXISTS idx_incident_materials_created_at
  ON public.incident_materials (created_at);

ALTER TABLE public.incident_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incident_materials_select_scope ON public.incident_materials;
DROP POLICY IF EXISTS incident_materials_insert_scope ON public.incident_materials;
DROP POLICY IF EXISTS incident_materials_update_scope ON public.incident_materials;
DROP POLICY IF EXISTS incident_materials_delete_scope ON public.incident_materials;

CREATE POLICY incident_materials_select_scope
ON public.incident_materials
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_director()
  OR EXISTS (
    SELECT 1
    FROM public.incidents i
    WHERE i.id = incident_materials.incident_id
      AND i.created_by = (SELECT auth.uid())
      AND public.is_approved_user()
  )
);

CREATE POLICY incident_materials_insert_scope
ON public.incident_materials
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.incidents i
    WHERE i.id = incident_materials.incident_id
      AND i.created_by = (SELECT auth.uid())
      AND public.is_approved_user()
  )
);

CREATE POLICY incident_materials_update_scope
ON public.incident_materials
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.incidents i
    WHERE i.id = incident_materials.incident_id
      AND i.created_by = (SELECT auth.uid())
      AND public.is_approved_user()
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.incidents i
    WHERE i.id = incident_materials.incident_id
      AND i.created_by = (SELECT auth.uid())
      AND public.is_approved_user()
  )
);

CREATE POLICY incident_materials_delete_scope
ON public.incident_materials
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP TRIGGER IF EXISTS update_incident_materials_updated_at ON public.incident_materials;
CREATE TRIGGER update_incident_materials_updated_at
BEFORE UPDATE ON public.incident_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.upsert_incident_materials(
  p_incident_id uuid,
  p_materials jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF jsonb_typeof(p_materials) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Materials payload must be a JSON array.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.incidents i
    WHERE i.id = p_incident_id
      AND (
        public.is_admin()
        OR (i.created_by = v_user_id AND public.is_approved_user())
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized: cannot upsert materials for this incident.';
  END IF;

  WITH parsed AS (
    SELECT
      NULLIF(btrim(item->>'client_material_id'), '') AS client_material_id,
      NULLIF(btrim(item->>'material_name'), '') AS material_name,
      NULLIF(item->>'quantity', '')::numeric AS quantity
    FROM jsonb_array_elements(p_materials) AS item
  ),
  valid AS (
    SELECT client_material_id, material_name, quantity
    FROM parsed
    WHERE client_material_id IS NOT NULL
      AND material_name IS NOT NULL
      AND quantity > 0
  ),
  upserted AS (
    INSERT INTO public.incident_materials (
      incident_id,
      client_material_id,
      material_name,
      quantity,
      created_by
    )
    SELECT
      p_incident_id,
      client_material_id,
      material_name,
      quantity,
      v_user_id
    FROM valid
    ON CONFLICT (incident_id, client_material_id) DO UPDATE SET
      material_name = EXCLUDED.material_name,
      quantity = EXCLUDED.quantity,
      updated_at = now()
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upserted;

  IF v_count <> jsonb_array_length(p_materials) THEN
    RAISE EXCEPTION 'Invalid material row: client_material_id, material_name, and positive quantity are required.';
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON public.incident_materials FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incident_materials TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_incident_materials(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_incident_materials(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_incident_report_breakdowns(
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_commune_id uuid DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_reclamation boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT i.*, c.name AS commune_name, up.name AS agent_name
    FROM public.incidents i
    LEFT JOIN public.communes c ON c.id = i.commune_id
    LEFT JOIN public.user_profiles up ON up.id = i.created_by
    WHERE i.created_at >= p_start_date
      AND i.created_at < p_end_date
      AND public.is_admin()
      AND (p_commune_id IS NULL OR i.commune_id = p_commune_id)
      AND (p_agent_id IS NULL OR i.created_by = p_agent_id)
      AND (p_type IS NULL OR i.type = p_type)
      AND (p_status IS NULL OR i.status = p_status)
      AND (p_reclamation IS NULL OR i.reclamation = p_reclamation)
  )
  SELECT jsonb_build_object(
    'monthly', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY month_start)
      FROM (
        SELECT date_trunc('month', created_at) AS month_start, to_char(date_trunc('month', created_at), 'YYYY-MM') AS label, COUNT(*) AS value
        FROM filtered
        GROUP BY date_trunc('month', created_at)
      ) m
    ), '[]'::jsonb),
    'byCommune', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label)
      FROM (
        SELECT COALESCE(commune_name, 'Commune inconnue') AS label, COUNT(*) AS value
        FROM filtered
        GROUP BY COALESCE(commune_name, 'Commune inconnue')
        ORDER BY COUNT(*) DESC, COALESCE(commune_name, 'Commune inconnue')
        LIMIT 20
      ) c
    ), '[]'::jsonb),
    'byAgent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label)
      FROM (
        SELECT COALESCE(agent_name, 'Agent inconnu') AS label, COUNT(*) AS value
        FROM filtered
        GROUP BY COALESCE(agent_name, 'Agent inconnu')
        ORDER BY COUNT(*) DESC, COALESCE(agent_name, 'Agent inconnu')
        LIMIT 20
      ) a
    ), '[]'::jsonb),
    'byIncidentType', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label)
      FROM (
        SELECT COALESCE(incident_type, 'Non classé') AS label, COUNT(*) AS value
        FROM filtered
        GROUP BY COALESCE(incident_type, 'Non classé')
        ORDER BY COUNT(*) DESC, COALESCE(incident_type, 'Non classé')
        LIMIT 20
      ) t
    ), '[]'::jsonb),
    'byDepartHta', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label)
      FROM (
        SELECT COALESCE(depart_hta, 'Non renseigné') AS label, COUNT(*) AS value
        FROM filtered
        WHERE type = 'MT'
        GROUP BY COALESCE(depart_hta, 'Non renseigné')
        ORDER BY COUNT(*) DESC, COALESCE(depart_hta, 'Non renseigné')
        LIMIT 20
      ) d
    ), '[]'::jsonb),
    'byMaterialQuantity', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label)
      FROM (
        SELECT im.material_name AS label, round(SUM(im.quantity), 3) AS value
        FROM public.incident_materials im
        JOIN filtered f ON f.id = im.incident_id
        GROUP BY im.material_name
        ORDER BY SUM(im.quantity) DESC, im.material_name
        LIMIT 20
      ) mat
    ), '[]'::jsonb)
  );
$$;

DROP FUNCTION IF EXISTS public.get_incident_report_rows(
  timestamp with time zone,
  timestamp with time zone,
  uuid,
  uuid,
  text,
  text,
  boolean,
  integer,
  integer
);

CREATE OR REPLACE FUNCTION public.get_incident_report_rows(
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_commune_id uuid DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_reclamation boolean DEFAULT NULL,
  p_limit integer DEFAULT 500,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  type text,
  status text,
  incident_type text,
  depart_hta text,
  commune_name text,
  village text,
  agent_name text,
  equipment_used text,
  reclamation boolean,
  created_at timestamp with time zone,
  closed_at timestamp with time zone,
  closure_duration_hours numeric,
  latitude double precision,
  longitude double precision,
  media_count integer,
  materials_summary text,
  materials jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
    COALESCE(mat.materials, '[]'::jsonb) AS materials
  FROM public.incidents i
  LEFT JOIN public.communes c ON c.id = i.commune_id
  LEFT JOIN public.user_profiles up ON up.id = i.created_by
  LEFT JOIN LATERAL (
    SELECT
      string_agg(im.material_name || ' x' || trim(trailing '.' from trim(trailing '0' from im.quantity::text)), '; ' ORDER BY im.created_at, im.id) AS materials_summary,
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
  ORDER BY i.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 2000)
  OFFSET GREATEST(p_offset, 0);
$$;

REVOKE EXECUTE ON FUNCTION public.get_incident_report_rows(timestamp with time zone, timestamp with time zone, uuid, uuid, text, text, boolean, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_incident_report_rows(timestamp with time zone, timestamp with time zone, uuid, uuid, text, text, boolean, integer, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.get_director_incidents(
  integer,
  timestamp with time zone,
  text,
  text,
  text
);

CREATE OR REPLACE FUNCTION public.get_director_incidents(
  p_limit integer DEFAULT 20,
  p_before_created_at timestamp with time zone DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  type text,
  date timestamp with time zone,
  village text,
  status text,
  incident_type text,
  depart_hta text,
  commune_id uuid,
  commune_name text,
  equipment_used text,
  description text,
  reclamation boolean,
  reclamation_name text,
  reclamation_by text,
  created_by uuid,
  created_by_name text,
  closed_by uuid,
  closed_by_name text,
  closed_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  latitude double precision,
  longitude double precision,
  media_urls text[],
  materials_summary text,
  materials jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      string_agg(im.material_name || ' x' || trim(trailing '.' from trim(trailing '0' from im.quantity::text)), '; ' ORDER BY im.created_at, im.id) AS materials_summary,
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
  WHERE (p_before_created_at IS NULL OR i.created_at < p_before_created_at)
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
  ORDER BY i.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_director_incidents(integer, timestamp with time zone, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_director_incidents(integer, timestamp with time zone, text, text, text) TO authenticated;
