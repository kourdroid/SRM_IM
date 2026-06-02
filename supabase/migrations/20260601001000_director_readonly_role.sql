-- Director read-only role support.
-- Directors can read global incidents and operational KPIs, but cannot mutate data.

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

CREATE OR REPLACE FUNCTION public.is_director()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'director'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_director()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.is_director();
$$;

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'incidents' AND policyname = 'incidents_field_select_own'
  ) THEN
    CREATE POLICY incidents_field_select_own
    ON public.incidents
    FOR SELECT
    TO authenticated
    USING (created_by = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'incidents' AND policyname = 'incidents_field_insert_own'
  ) THEN
    CREATE POLICY incidents_field_insert_own
    ON public.incidents
    FOR INSERT
    TO authenticated
    WITH CHECK (created_by = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'incidents' AND policyname = 'incidents_field_update_own'
  ) THEN
    CREATE POLICY incidents_field_update_own
    ON public.incidents
    FOR UPDATE
    TO authenticated
    USING (created_by = (SELECT auth.uid()))
    WITH CHECK (created_by = (SELECT auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'incidents' AND policyname = 'incidents_admin_all'
  ) THEN
    CREATE POLICY incidents_admin_all
    ON public.incidents
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'incidents' AND policyname = 'incidents_director_select_all'
  ) THEN
    CREATE POLICY incidents_director_select_all
    ON public.incidents
    FOR SELECT
    TO authenticated
    USING (public.is_director());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_director_dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_director() THEN
    RAISE EXCEPTION 'Unauthorized: director read access required.';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'total', COUNT(*),
      'open', COUNT(*) FILTER (WHERE status = 'open'),
      'closed', COUNT(*) FILTER (WHERE status = 'closed'),
      'reclamations', COUNT(*) FILTER (WHERE reclamation = true),
      'avgClosureDays', COALESCE(
        AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400)
          FILTER (WHERE status = 'closed' AND closed_at IS NOT NULL),
        0
      ),
      'longestOpenHours', COALESCE(
        MAX(EXTRACT(EPOCH FROM (now() - created_at)) / 3600)
          FILTER (WHERE status = 'open'),
        0
      )
    )
    FROM public.incidents
  );
END;
$$;

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
      OR c.name ILIKE '%' || p_search || '%'
    )
  ORDER BY i.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_director_dashboard_metrics() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_director_incidents(integer, timestamp with time zone, text, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_director_dashboard_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_director_incidents(integer, timestamp with time zone, text, text, text) TO authenticated;
