-- Isolated test database only.
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY,email text);
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TABLE IF NOT EXISTS public.user_profiles(id uuid PRIMARY KEY,name text,role text,approval_status text);
CREATE TABLE IF NOT EXISTS public.communes(id uuid PRIMARY KEY,name text);
CREATE TABLE IF NOT EXISTS public.incidents(
id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text,type text,date timestamptz,village text,status text DEFAULT 'open',incident_type text,
depart_hta text,commune_id uuid,equipment_used text,description text,reclamation boolean DEFAULT false,
reclamation_name text,reclamation_by text,created_by uuid,closed_by uuid,closed_at timestamptz,
created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),latitude double precision,longitude double precision,media_urls text[],archived_at timestamptz);
CREATE TABLE IF NOT EXISTS public.incident_materials(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),incident_id uuid,client_material_id text,material_name text,quantity numeric,created_by uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(incident_id,client_material_id));
GRANT SELECT,UPDATE ON public.incidents TO authenticated;
GRANT SELECT ON public.incident_materials,public.user_profiles TO authenticated;
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND approval_status = 'approved'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_director() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='director' AND approval_status='approved')
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_director()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_admin() OR public.is_director();
$function$;

CREATE OR REPLACE FUNCTION public.is_approved_field()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'field' AND approval_status = 'approved');
$function$;

CREATE OR REPLACE FUNCTION public.upsert_incident_materials(p_incident_id uuid, p_materials jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_user_id uuid := auth.uid();

  v_count integer := 0;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION 'Authentication required.';

  END IF;



  IF jsonb_typeof(p_materials) IS DISTINCT FROM 'array' THEN

    RAISE EXCEPTION 'Materials payload must be a JSON array.';

  END IF;



  IF NOT EXISTS (

    SELECT 1

    FROM public.incidents i

    WHERE i.id = p_incident_id

      AND (

        public.is_admin()

        OR (i.created_by = v_user_id AND public.is_approved_field())

      )

  ) THEN

    RAISE EXCEPTION 'Unauthorized: cannot upsert materials for this incident.';

  END IF;



  WITH parsed AS (

    SELECT

      NULLIF(btrim(item->>'client_material_id'), '') AS client_material_id,

      NULLIF(btrim(item->>'material_name'), '') AS material_name,

      NULLIF(item->>'quantity', '')::numeric AS quantity

    FROM jsonb_array_elements(p_materials) AS item

  ),

  valid AS (

    SELECT client_material_id, material_name, quantity

    FROM parsed

    WHERE client_material_id IS NOT NULL

      AND material_name IS NOT NULL

      AND quantity > 0

  ),

  upserted AS (

    INSERT INTO public.incident_materials (

      incident_id,

      client_material_id,

      material_name,

      quantity,

      created_by

    )

    SELECT

      p_incident_id,

      client_material_id,

      material_name,

      quantity,

      v_user_id

    FROM valid

    ON CONFLICT (incident_id, client_material_id) DO UPDATE SET

      material_name = EXCLUDED.material_name,

      quantity = EXCLUDED.quantity,

      updated_at = now()

    RETURNING 1

  )

  SELECT COUNT(*) INTO v_count FROM upserted;



  IF v_count <> jsonb_array_length(p_materials) THEN

    RAISE EXCEPTION 'Invalid material row: client_material_id, material_name, and positive quantity are required.';

  END IF;



  RETURN v_count;

END;

$function$;
