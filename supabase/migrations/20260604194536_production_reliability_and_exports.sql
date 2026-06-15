-- Production reliability: preserve incident history and support server-generated exports.

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_incidents_created_by_updated_at_id
  ON public.incidents (created_by, updated_at, id);

CREATE INDEX IF NOT EXISTS idx_incidents_active_created_at
  ON public.incidents (created_at DESC)
  WHERE archived_at IS NULL;

REVOKE DELETE ON public.incidents FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.archive_incident(p_incident_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.incidents
  SET archived_at = now(), archived_by = auth.uid(), updated_at = now()
  WHERE id = p_incident_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_incident(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_incident(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.report_exports (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  format text NOT NULL CHECK (format IN ('csv')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'failed', 'done')),
  storage_path text,
  row_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_report_exports_requested_created_at
  ON public.report_exports (requested_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_exports_status_created_at
  ON public.report_exports (status, created_at);

ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can create report exports" ON public.report_exports;
CREATE POLICY "Admins can create report exports"
ON public.report_exports FOR INSERT TO authenticated
WITH CHECK (
  requested_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can read own report exports" ON public.report_exports;
CREATE POLICY "Admins can read own report exports"
ON public.report_exports FOR SELECT TO authenticated
USING (
  requested_by = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  )
);

REVOKE ALL ON public.report_exports FROM anon;
GRANT SELECT, INSERT ON public.report_exports TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('report-exports', 'report-exports', false)
ON CONFLICT (id) DO UPDATE SET public = false;
