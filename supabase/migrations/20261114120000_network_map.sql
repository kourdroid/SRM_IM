-- HTA network map (postes sources and départ lines) imported from the DPSB Google My Maps export.
-- Data is loaded by scripts/import-network-kml.cjs, not by this migration: the grid geometry stays out of git.
-- Geometry is stored as GeoJSON (jsonb) so the dashboard can draw it directly without PostGIS.

CREATE TABLE IF NOT EXISTS public.network_postes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  longitude double precision NOT NULL,
  latitude double precision NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_network_postes_name_unique
  ON public.network_postes (lower(name));

CREATE TABLE IF NOT EXISTS public.network_departs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poste_source text NOT NULL,
  depart text NOT NULL,
  -- The départ as agents pick it in the mobile app, when one matches.
  depart_hta_option_id uuid REFERENCES public.depart_hta_options (id) ON DELETE SET NULL,
  aerial_km numeric(8, 2) NOT NULL DEFAULT 0,
  underground_km numeric(8, 2) NOT NULL DEFAULT 0,
  aerial_geometry jsonb,
  underground_geometry jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_network_departs_poste_depart_unique
  ON public.network_departs (poste_source, depart);

CREATE INDEX IF NOT EXISTS idx_network_departs_option
  ON public.network_departs (depart_hta_option_id);

ALTER TABLE public.network_postes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_departs ENABLE ROW LEVEL SECURITY;

-- Grid layout is sensitive infrastructure data: only supervision roles can read it. No write policies;
-- the import runs as the database owner.
DROP POLICY IF EXISTS network_postes_read ON public.network_postes;
CREATE POLICY network_postes_read
ON public.network_postes
FOR SELECT
TO authenticated
USING ((SELECT public.is_admin_or_director()));

DROP POLICY IF EXISTS network_departs_read ON public.network_departs;
CREATE POLICY network_departs_read
ON public.network_departs
FOR SELECT
TO authenticated
USING ((SELECT public.is_admin_or_director()));

REVOKE ALL ON public.network_postes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.network_departs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.network_postes TO authenticated;
GRANT SELECT ON public.network_departs TO authenticated;
