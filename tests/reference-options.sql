\set ON_ERROR_STOP on
-- Disposable PostgreSQL fixture only, run via reference-options-postgres.cjs.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$
  SELECT COALESCE(current_setting('test.is_admin', true), 'true')::boolean;
$$;
CREATE TABLE public.incident_type_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), network_type text NOT NULL, name text NOT NULL,
  active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE public.depart_hta_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0
);
\ir ../supabase/migrations/20261107090000_fix_reference_option_create_ambiguity.sql

CREATE FUNCTION public.expect_failure(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN RETURN;
  END;
  RAISE EXCEPTION 'Expected rejection: %', statement;
END $$;

DO $$
DECLARE created record;
BEGIN
  -- Sort order is counted per network, so MT must not continue from BT.
  SELECT * INTO created FROM public.create_incident_type_option_by_admin('bt', ' Câble BT carbonisé ');
  ASSERT created.network_type = 'BT' AND created.name = 'Câble BT carbonisé' AND created.active
    AND created.sort_order = 10 AND created.incident_count = 0;
  SELECT * INTO created FROM public.create_incident_type_option_by_admin('BT', 'Manque phase');
  ASSERT created.sort_order = 20;
  SELECT * INTO created FROM public.create_incident_type_option_by_admin('MT', 'Manque phase');
  ASSERT created.network_type = 'MT' AND created.sort_order = 10;
  ASSERT (SELECT count(*) FROM public.incident_type_options) = 3;
  PERFORM public.expect_failure($sql$SELECT public.create_incident_type_option_by_admin('BT', 'manque phase')$sql$);
  PERFORM public.expect_failure($sql$SELECT public.create_incident_type_option_by_admin('XX', 'Autre')$sql$);

  SELECT * INTO created FROM public.create_depart_hta_option_by_admin('Départ Nord');
  ASSERT created.name = 'Départ Nord' AND created.active AND created.sort_order = 10 AND created.incident_count = 0;
  SELECT * INTO created FROM public.create_depart_hta_option_by_admin('Départ Sud');
  ASSERT created.sort_order = 20;
  PERFORM public.expect_failure($sql$SELECT public.create_depart_hta_option_by_admin('départ nord')$sql$);

  PERFORM set_config('test.is_admin', 'false', true);
  PERFORM public.expect_failure($sql$SELECT public.create_incident_type_option_by_admin('BT', 'Non admin')$sql$);
  PERFORM public.expect_failure($sql$SELECT public.create_depart_hta_option_by_admin('Non admin')$sql$);
END $$;

SELECT 'reference options regression passed' AS result;
