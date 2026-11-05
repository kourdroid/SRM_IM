\set ON_ERROR_STOP on
-- Disposable PostgreSQL fixture only, run via material-closure-postgres.cjs.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
  SELECT '12345678-1234-4234-8234-123456789abc'::uuid;
$$;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql AS $$
  SELECT COALESCE(current_setting('test.is_admin', true), 'true')::boolean;
$$;
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY, type text, status text DEFAULT 'open', equipment_used text DEFAULT '',
  archived_at timestamptz, updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.incident_materials (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  incident_id uuid REFERENCES public.incidents, client_material_id text UNIQUE,
  material_name text, quantity numeric CHECK (quantity > 0), created_at timestamptz DEFAULT now()
);
CREATE FUNCTION public.upsert_incident_materials(p_incident_id uuid, p_materials jsonb)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.incident_materials(incident_id,client_material_id,material_name,quantity)
  SELECT p_incident_id,item->>'client_material_id',item->>'material_name',(item->>'quantity')::numeric
  FROM jsonb_array_elements(p_materials) item
  ON CONFLICT(client_material_id) DO UPDATE SET quantity=excluded.quantity;
$$;
\ir ../supabase/migrations/20260614120000_require_materials_before_closure.sql
\ir ../supabase/migrations/20261026213552_atomic_closure_and_stable_pagination.sql
\ir ../supabase/migrations/20261102175300_explicit_no_material_closure.sql

CREATE FUNCTION public.expect_failure(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN RETURN;
  END;
  RAISE EXCEPTION 'Expected rejection: %', statement;
END $$;

DO $$
DECLARE incident uuid; network text;
BEGIN
  FOREACH network IN ARRAY ARRAY['BT','MT'] LOOP
    incident := gen_random_uuid();
    INSERT INTO public.incidents(id,type) VALUES (incident,network);
    ASSERT (SELECT NOT no_material_used FROM public.incidents WHERE id=incident);
    PERFORM public.expect_failure(format('UPDATE public.incidents SET status=''closed'' WHERE id=%L',incident));
    PERFORM public.expect_failure(format('SELECT public.close_incident_with_materials(%L,''[]'',false)',incident));
    PERFORM public.expect_failure(format('SELECT public.close_incident_with_materials(%L,''[{"client_material_id":"invalid","material_name":"Cable","quantity":0}]'',false)',incident));
    -- The field offline path updates status and declaration together.
    UPDATE public.incidents SET status='closed',no_material_used=true WHERE id=incident;
    ASSERT (SELECT equipment_used='Aucun matériel utilisé' AND no_material_used FROM public.incidents WHERE id=incident);
    ASSERT NOT EXISTS (SELECT 1 FROM public.incident_materials WHERE incident_id=incident);
    PERFORM public.expect_failure(format('INSERT INTO public.incident_materials(incident_id,client_material_id,material_name,quantity) VALUES (%L,%L,''Cable'',2)',incident,incident::text));
    PERFORM public.expect_failure(format('UPDATE public.incidents SET no_material_used=false WHERE id=%L',incident));
    UPDATE public.incidents SET status='open' WHERE id=incident;
    ASSERT (SELECT NOT no_material_used AND equipment_used='' FROM public.incidents WHERE id=incident);
    -- The admin path and idempotent retry.
    PERFORM public.close_incident_with_materials(incident,'[]',true);
    PERFORM public.close_incident_with_materials(incident,'[]',true);
    UPDATE public.incidents SET status='open' WHERE id=incident;
    PERFORM public.close_incident_with_materials(incident,
      jsonb_build_array(jsonb_build_object('client_material_id',incident::text,'material_name','Cable','quantity',2)),false);
    ASSERT (SELECT status='closed' AND NOT no_material_used AND equipment_used='Cable x2' FROM public.incidents WHERE id=incident);
    UPDATE public.incidents SET status='open' WHERE id=incident;
    PERFORM public.expect_failure(format('SELECT public.close_incident_with_materials(%L,''[]'',true)',incident));
    ASSERT EXISTS (SELECT 1 FROM public.incident_materials WHERE incident_id=incident AND quantity=2);
    -- Existing clients can still use the two-argument RPC.
    PERFORM public.close_incident_with_materials(incident,
      jsonb_build_array(jsonb_build_object('client_material_id',incident::text,'material_name','Cable','quantity',2)));
    ASSERT (SELECT status='closed' FROM public.incidents WHERE id=incident);
  END LOOP;
  PERFORM set_config('test.is_admin','false',true);
  PERFORM public.expect_failure(format('SELECT public.close_incident_with_materials(%L,''[]'',true)',gen_random_uuid()));
END $$;
SELECT 'PASS: BT/MT opening, explicit none, material closure, validation, retries, reopening, preservation and admin authorization';
