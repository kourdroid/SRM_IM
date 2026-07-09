-- Expand report rows with export-only details while preserving the existing RPC name and parameters.

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
  materials jsonb,
  description text,
  reclamation_name text,
  reclamation_by text
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
    COALESCE(mat.materials, '[]'::jsonb) AS materials,
    i.description,
    i.reclamation_name,
    i.reclamation_by
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
