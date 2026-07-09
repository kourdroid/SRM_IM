-- Ensure server-side XLSX report exports have their required table and bucket.
-- This is intentionally idempotent so it can repair projects where the
-- original export infrastructure migration was skipped.

CREATE TABLE IF NOT EXISTS public.report_exports (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  format text NOT NULL DEFAULT 'xlsx',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
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

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.report_exports'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%format%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.report_exports DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.report_exports
    ADD CONSTRAINT report_exports_format_check CHECK (format IN ('csv', 'xlsx'));
END;
$$;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.report_exports'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.report_exports DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.report_exports
    ADD CONSTRAINT report_exports_status_check CHECK (status IN ('pending', 'running', 'failed', 'done'));
END;
$$;

DROP POLICY IF EXISTS "Admins can create report exports" ON public.report_exports;
CREATE POLICY "Admins can create report exports"
ON public.report_exports FOR INSERT TO authenticated
WITH CHECK (
  requested_by = (SELECT auth.uid())
  AND public.is_admin()
);

DROP POLICY IF EXISTS "Admins can read own report exports" ON public.report_exports;
CREATE POLICY "Admins can read own report exports"
ON public.report_exports FOR SELECT TO authenticated
USING (
  requested_by = (SELECT auth.uid())
  AND public.is_admin()
);

REVOKE ALL ON public.report_exports FROM anon;
GRANT SELECT, INSERT ON public.report_exports TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('report-exports', 'report-exports', false)
ON CONFLICT (id) DO UPDATE SET public = false;
