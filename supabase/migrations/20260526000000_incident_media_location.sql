-- Incident media and GPS support for field reports.

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE INDEX IF NOT EXISTS idx_incidents_created_by_created_at
  ON public.incidents (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_commune_id
  ON public.incidents (commune_id);

CREATE INDEX IF NOT EXISTS idx_incidents_status_created_at
  ON public.incidents (status, created_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-media', 'incident-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'incident_media_public_read'
  ) THEN
    CREATE POLICY incident_media_public_read
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'incident-media');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'incident_media_authenticated_insert'
  ) THEN
    CREATE POLICY incident_media_authenticated_insert
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'incident-media');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'incident_media_authenticated_update'
  ) THEN
    CREATE POLICY incident_media_authenticated_update
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'incident-media')
      WITH CHECK (bucket_id = 'incident-media');
  END IF;
END $$;
