-- Idempotent mobile sync support.

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS gps_accuracy double precision;

CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_client_id
  ON public.incidents (client_id)
  WHERE client_id IS NOT NULL;
