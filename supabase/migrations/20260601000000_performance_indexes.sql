-- Performance indexes for incremental sync, admin filters, and annual reporting.
-- Additive only; safe to run on an existing Supabase project.

CREATE INDEX IF NOT EXISTS idx_incidents_updated_at
  ON public.incidents (updated_at);

CREATE INDEX IF NOT EXISTS idx_incidents_created_by_updated_at
  ON public.incidents (created_by, updated_at);

CREATE INDEX IF NOT EXISTS idx_incidents_status_created_at_desc
  ON public.incidents (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_commune_created_at_desc
  ON public.incidents (commune_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_created_by_date_desc
  ON public.incidents (created_by, date DESC);
