-- Add Départ HTA as a first-class incident attribute for MT reporting.
-- This is additive for existing incidents; the mobile app enforces MT selection on new data.

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS depart_hta text;

CREATE INDEX IF NOT EXISTS idx_incidents_depart_hta_created_at
  ON public.incidents (depart_hta, created_at DESC)
  WHERE depart_hta IS NOT NULL;

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
      AND EXISTS (
        SELECT 1 FROM public.user_profiles admin_profile
        WHERE admin_profile.id = auth.uid() AND admin_profile.role = 'admin'
      )
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
        LIMIT 20
      ) c
    ), '[]'::jsonb),
    'byAgent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label)
      FROM (
        SELECT COALESCE(agent_name, 'Agent inconnu') AS label, COUNT(*) AS value
        FROM filtered
        GROUP BY COALESCE(agent_name, 'Agent inconnu')
        LIMIT 20
      ) a
    ), '[]'::jsonb),
    'byIncidentType', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'value', value) ORDER BY value DESC, label)
      FROM (
        SELECT COALESCE(incident_type, 'Non classé') AS label, COUNT(*) AS value
        FROM filtered
        GROUP BY COALESCE(incident_type, 'Non classé')
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
        LIMIT 20
      ) d
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
  media_count integer
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
    cardinality(COALESCE(i.media_urls, '{}'::text[])) AS media_count
  FROM public.incidents i
  LEFT JOIN public.communes c ON c.id = i.commune_id
  LEFT JOIN public.user_profiles up ON up.id = i.created_by
  WHERE i.created_at >= p_start_date
    AND i.created_at < p_end_date
    AND EXISTS (
      SELECT 1 FROM public.user_profiles admin_profile
      WHERE admin_profile.id = auth.uid() AND admin_profile.role = 'admin'
    )
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
  media_urls text[]
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
    i.media_urls
  FROM public.incidents i
  LEFT JOIN public.communes c ON c.id = i.commune_id
  LEFT JOIN public.user_profiles creator ON creator.id = i.created_by
  LEFT JOIN public.user_profiles closer ON closer.id = i.closed_by
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
    )
  ORDER BY i.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_director_incidents(integer, timestamp with time zone, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_director_incidents(integer, timestamp with time zone, text, text, text) TO authenticated;
