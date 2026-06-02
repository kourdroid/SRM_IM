-- Permanent incident archive, media normalization, audit events, and reporting RPCs.

CREATE TABLE IF NOT EXISTS public.incident_events (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid NULL REFERENCES auth.users(id),
  source text NOT NULL DEFAULT 'system' CHECK (source IN ('field_app', 'admin_app', 'sync', 'system')),
  client_event_id text NULL,
  old_values jsonb NULL,
  new_values jsonb NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_events_client_event_id
  ON public.incident_events (incident_id, client_event_id);

CREATE INDEX IF NOT EXISTS idx_incident_events_incident_created_at
  ON public.incident_events (incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.incident_media (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  client_media_id text NOT NULL,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  uploaded_by uuid NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_media_incident_client_media
  ON public.incident_media (incident_id, client_media_id);

CREATE INDEX IF NOT EXISTS idx_incident_media_incident_id
  ON public.incident_media (incident_id);

CREATE INDEX IF NOT EXISTS idx_incidents_report_created_at
  ON public.incidents (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_report_commune_created_at
  ON public.incidents (commune_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_report_created_by_created_at
  ON public.incidents (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_report_type_created_at
  ON public.incidents (type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_report_status_created_at
  ON public.incidents (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_report_closed_at
  ON public.incidents (closed_at)
  WHERE closed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.append_incident_media(
  p_incident_id uuid,
  p_client_media_id text,
  p_storage_path text,
  p_public_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.incident_media (
    incident_id,
    client_media_id,
    storage_path,
    public_url,
    uploaded_by
  )
  VALUES (
    p_incident_id,
    p_client_media_id,
    p_storage_path,
    p_public_url,
    auth.uid()
  )
  ON CONFLICT (incident_id, client_media_id) DO UPDATE
  SET
    storage_path = EXCLUDED.storage_path,
    public_url = EXCLUDED.public_url;

  UPDATE public.incidents
  SET
    media_urls = (
      SELECT array_agg(DISTINCT url)
      FROM unnest(COALESCE(media_urls, '{}'::text[]) || ARRAY[p_public_url]) AS url
    ),
    updated_at = now()
  WHERE id = p_incident_id;

  INSERT INTO public.incident_events (
    incident_id,
    event_type,
    actor_id,
    source,
    client_event_id,
    new_values
  )
  VALUES (
    p_incident_id,
    'media_attached',
    auth.uid(),
    'sync',
    'media:' || p_client_media_id,
    jsonb_build_object('public_url', p_public_url, 'storage_path', p_storage_path)
  )
  ON CONFLICT (incident_id, client_event_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_incident_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.incident_events (
      incident_id,
      event_type,
      actor_id,
      source,
      client_event_id,
      new_values
    )
    VALUES (
      NEW.id,
      'incident_created',
      NEW.created_by,
      'field_app',
      'created:' || COALESCE(NEW.client_id, NEW.id::text),
      to_jsonb(NEW)
    )
    ON CONFLICT (incident_id, client_event_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.incident_events (
      incident_id,
      event_type,
      actor_id,
      source,
      client_event_id,
      old_values,
      new_values
    )
    VALUES (
      NEW.id,
      'incident_status_changed',
      auth.uid(),
      'admin_app',
      'status:' || NEW.id::text || ':' || extract(epoch from now())::text,
      jsonb_build_object('status', OLD.status, 'closed_by', OLD.closed_by, 'closed_at', OLD.closed_at),
      jsonb_build_object('status', NEW.status, 'closed_by', NEW.closed_by, 'closed_at', NEW.closed_at)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_incident_event_trigger ON public.incidents;

CREATE TRIGGER record_incident_event_trigger
AFTER INSERT OR UPDATE ON public.incidents
FOR EACH ROW
EXECUTE FUNCTION public.record_incident_event();

INSERT INTO public.incident_events (
  incident_id,
  event_type,
  actor_id,
  source,
  client_event_id,
  new_values,
  created_at
)
SELECT
  i.id,
  'incident_created',
  i.created_by,
  'system',
  'backfill-created:' || i.id::text,
  to_jsonb(i),
  COALESCE(i.created_at, now())
FROM public.incidents i
ON CONFLICT (incident_id, client_event_id) DO NOTHING;

INSERT INTO public.incident_media (
  incident_id,
  client_media_id,
  storage_path,
  public_url,
  uploaded_by,
  created_at
)
SELECT
  i.id,
  'backfill-' || md5(url),
  '',
  url,
  i.created_by,
  COALESCE(i.created_at, now())
FROM public.incidents i
CROSS JOIN LATERAL unnest(COALESCE(i.media_urls, '{}'::text[])) AS url
ON CONFLICT (incident_id, client_media_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_incident_report_summary(
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
    SELECT *
    FROM public.incidents i
    WHERE i.created_at >= p_start_date
      AND i.created_at < p_end_date
      AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'admin'
      )
      AND (p_commune_id IS NULL OR i.commune_id = p_commune_id)
      AND (p_agent_id IS NULL OR i.created_by = p_agent_id)
      AND (p_type IS NULL OR i.type = p_type)
      AND (p_status IS NULL OR i.status = p_status)
      AND (p_reclamation IS NULL OR i.reclamation = p_reclamation)
  )
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'open', COUNT(*) FILTER (WHERE status = 'open'),
    'closed', COUNT(*) FILTER (WHERE status = 'closed'),
    'reclamations', COUNT(*) FILTER (WHERE reclamation = true),
    'bt', COUNT(*) FILTER (WHERE type = 'BT'),
    'mt', COUNT(*) FILTER (WHERE type = 'MT'),
    'missingGps', COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL),
    'missingPhoto', COUNT(*) FILTER (
      WHERE media_urls IS NULL OR cardinality(media_urls) = 0
    ),
    'avgClosureDays', COALESCE(AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400) FILTER (WHERE closed_at IS NOT NULL), 0),
    'maxClosureDays', COALESCE(MAX(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400) FILTER (WHERE closed_at IS NOT NULL), 0)
  )
  FROM filtered;
$$;

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
    ), '[]'::jsonb)
  );
$$;

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
  commune_name text,
  village text,
  agent_name text,
  equipment_used text,
  reclamation boolean,
  created_at timestamp with time zone,
  closed_at timestamp with time zone,
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
    c.name AS commune_name,
    i.village,
    up.name AS agent_name,
    i.equipment_used,
    i.reclamation,
    i.created_at,
    i.closed_at,
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

REVOKE EXECUTE ON FUNCTION public.append_incident_media(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_incident_report_summary(timestamp with time zone, timestamp with time zone, uuid, uuid, text, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_incident_report_breakdowns(timestamp with time zone, timestamp with time zone, uuid, uuid, text, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_incident_report_rows(timestamp with time zone, timestamp with time zone, uuid, uuid, text, text, boolean, integer, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.append_incident_media(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_incident_report_summary(timestamp with time zone, timestamp with time zone, uuid, uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_incident_report_breakdowns(timestamp with time zone, timestamp with time zone, uuid, uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_incident_report_rows(timestamp with time zone, timestamp with time zone, uuid, uuid, text, text, boolean, integer, integer) TO authenticated;
