-- Verified against SRM's deployed policies and function definitions on 2026-10-14.
-- Existing photo URLs remain public for compatibility; writes become scoped.
CREATE OR REPLACE FUNCTION public.is_approved_field()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles
    WHERE id = (SELECT auth.uid()) AND role = 'field' AND approval_status = 'approved');
$$;
REVOKE ALL ON FUNCTION public.is_approved_field() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_field() TO authenticated, service_role;

-- Remove all OR-combined legacy incident/profile policies, then define one model.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('incidents', 'user_profiles', 'incident_media', 'incident_events')
  LOOP EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename); END LOOP;
END $$;

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY intervx_profiles_read ON public.user_profiles FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY intervx_profiles_signup ON public.user_profiles FOR INSERT TO authenticated
WITH CHECK ((id = (SELECT auth.uid()) AND role = 'field' AND approval_status = 'pending') OR public.is_admin());
CREATE POLICY intervx_profiles_update ON public.user_profiles FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()) OR public.is_admin())
WITH CHECK (id = (SELECT auth.uid()) OR public.is_admin());
CREATE POLICY intervx_profiles_delete ON public.user_profiles FOR DELETE TO authenticated
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() AND
    (NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'Only approved administrators can change account privileges' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_profile_privileges ON public.user_profiles;
CREATE TRIGGER guard_profile_privileges BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

CREATE POLICY intervx_incidents_read ON public.incidents FOR SELECT TO authenticated
USING (public.is_admin_or_director() OR (public.is_approved_field() AND created_by = (SELECT auth.uid())));
CREATE POLICY intervx_incidents_insert ON public.incidents FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR (public.is_approved_field() AND created_by = (SELECT auth.uid())));
CREATE POLICY intervx_incidents_update ON public.incidents FOR UPDATE TO authenticated
USING (public.is_admin() OR (public.is_approved_field() AND created_by = (SELECT auth.uid())))
WITH CHECK (public.is_admin() OR (public.is_approved_field() AND created_by = (SELECT auth.uid())));
CREATE POLICY intervx_incidents_delete ON public.incidents FOR DELETE TO authenticated
USING (public.is_admin());

CREATE POLICY intervx_media_read ON public.incident_media FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_id));
CREATE POLICY intervx_events_read ON public.incident_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_id));
REVOKE INSERT, UPDATE, DELETE ON public.incident_events, public.incident_media FROM anon, authenticated;
REVOKE SELECT ON public.incident_events, public.incident_media FROM anon;
GRANT SELECT ON public.incident_events, public.incident_media TO authenticated;

CREATE OR REPLACE FUNCTION public.can_write_incident_media(object_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE incident_uuid uuid;
BEGIN
  IF object_name IS NULL OR object_name !~ '^incidents/[0-9a-fA-F-]{36}/[a-zA-Z0-9_-]+\.jpg$' THEN RETURN false; END IF;
  BEGIN incident_uuid := split_part(object_name, '/', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
  RETURN EXISTS (SELECT 1 FROM public.incidents i WHERE i.id = incident_uuid
    AND (public.is_admin() OR (public.is_approved_field() AND i.created_by = auth.uid())));
END $$;
REVOKE ALL ON FUNCTION public.can_write_incident_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_incident_media(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS incident_media_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS incident_media_authenticated_update ON storage.objects;
CREATE POLICY intervx_media_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'incident-media' AND public.can_write_incident_media(name));
CREATE POLICY intervx_media_storage_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'incident-media' AND public.can_write_incident_media(name))
WITH CHECK (bucket_id = 'incident-media' AND public.can_write_incident_media(name));
CREATE POLICY intervx_media_storage_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'incident-media' AND public.can_write_incident_media(name));
UPDATE storage.buckets SET file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg']
WHERE id = 'incident-media';

CREATE OR REPLACE FUNCTION public.append_incident_media(
  p_incident_id uuid, p_client_media_id text, p_storage_path text, p_public_url text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_incident_media(p_storage_path)
    OR split_part(p_storage_path, '/', 2) IS DISTINCT FROM p_incident_id::text THEN
    RAISE EXCEPTION 'Unauthorized incident media attachment' USING ERRCODE = '42501';
  END IF;
  IF p_client_media_id IS NULL OR length(p_client_media_id) NOT BETWEEN 1 AND 200
    OR p_public_url IS DISTINCT FROM
       'https://tnytudtejqislmkpqaiq.supabase.co/storage/v1/object/public/incident-media/' || p_storage_path
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'incident-media' AND name = p_storage_path) THEN
    RAISE EXCEPTION 'Invalid incident media reference' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.incident_media (incident_id, client_media_id, storage_path, public_url, uploaded_by)
  VALUES (p_incident_id, p_client_media_id, p_storage_path, p_public_url, auth.uid())
  ON CONFLICT (incident_id, client_media_id) DO UPDATE
  SET storage_path = EXCLUDED.storage_path, public_url = EXCLUDED.public_url;
  UPDATE public.incidents SET media_urls = (
    SELECT array_agg(DISTINCT url) FROM unnest(COALESCE(media_urls, '{}'::text[]) || ARRAY[p_public_url]) url
  ), updated_at = now() WHERE id = p_incident_id;
  INSERT INTO public.incident_events (incident_id,event_type,actor_id,source,client_event_id,new_values)
  VALUES (p_incident_id,'media_attached',auth.uid(),'sync','media:' || p_client_media_id,
    jsonb_build_object('public_url',p_public_url,'storage_path',p_storage_path))
  ON CONFLICT (incident_id,client_event_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.append_incident_media(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_incident_media(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.archive_incident(p_incident_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Approved admin required' USING ERRCODE = '42501'; END IF;
  UPDATE public.incidents SET archived_at = now(), archived_by = auth.uid(), updated_at = now() WHERE id = p_incident_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found' USING ERRCODE = 'P0002'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.archive_incident(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_incident(uuid) TO authenticated;

CREATE OR REPLACE VIEW public.dashboard_stats_view WITH (security_invoker = true) AS
SELECT count(*) AS total, count(*) FILTER (WHERE status = 'open') AS open,
 count(*) FILTER (WHERE status = 'closed') AS closed,
 count(*) FILTER (WHERE reclamation = true) AS reclamations
FROM public.incidents WHERE public.is_admin_or_director();
REVOKE ALL ON public.dashboard_stats_view FROM anon;
GRANT SELECT ON public.dashboard_stats_view TO authenticated;

CREATE OR REPLACE FUNCTION public.get_monthly_incidents(target_year integer)
RETURNS TABLE(label text,value bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin_or_director() THEN RAISE EXCEPTION 'Approved admin or director required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT to_char(date_trunc('month',i.created_at),'Mon'), count(*)
  FROM public.incidents i WHERE extract(year from i.created_at) = target_year
  GROUP BY date_trunc('month',i.created_at) ORDER BY date_trunc('month',i.created_at);
END $$;
CREATE OR REPLACE FUNCTION public.get_resolution_time_stats()
RETURNS TABLE(avg_days numeric,max_days numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin_or_director() THEN RAISE EXCEPTION 'Approved admin or director required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT round(avg(extract(epoch FROM (i.closed_at-i.created_at))/86400)::numeric,1),
    round(max(extract(epoch FROM (i.closed_at-i.created_at))/86400)::numeric,1)
  FROM public.incidents i WHERE i.status='closed' AND i.closed_at IS NOT NULL AND i.created_at >= now()-interval '30 days';
END $$;
REVOKE ALL ON FUNCTION public.get_monthly_incidents(integer), public.get_resolution_time_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_monthly_incidents(integer), public.get_resolution_time_stats() TO authenticated;

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
$function$
;

CREATE OR REPLACE FUNCTION public.create_user_by_admin(user_email text, user_password text, user_name text, user_role text DEFAULT 'field'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  new_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin' AND approval_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can create users.';
  END IF;
  IF user_email IS NULL OR user_password IS NULL OR user_name IS NULL THEN
    RAISE EXCEPTION 'Missing required fields: email, password, name';
  END IF;
  IF length(user_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;
  IF user_role NOT IN ('field', 'admin') THEN
    RAISE EXCEPTION 'Role must be field or admin';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    RAISE EXCEPTION 'Cet email est déjà utilisé.';
  END IF;
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    user_email,
    extensions.crypt(user_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('name', user_name),
    now(), now(),
    '', '', '', ''
  )
  RETURNING id INTO new_user_id;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = new_user_id) THEN
    INSERT INTO public.user_profiles (id, name, role)
    VALUES (new_user_id, user_name, user_role);
  ELSE
    UPDATE public.user_profiles
    SET name = user_name, role = user_role
    WHERE id = new_user_id;
  END IF;
  RETURN json_build_object(
    'id', new_user_id,
    'email', user_email,
    'name', user_name,
    'role', user_role
  );
END;
$function$
;

-- Guard every privileged public function against anonymous/default execution.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef
 LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',f.signature);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',f.signature);
 END LOOP;
END $$;

-- Directors remain read-only even for historically attributed materials.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='incident_materials'
 LOOP EXECUTE format('DROP POLICY %I ON public.incident_materials',p.policyname); END LOOP;
END $$;
CREATE POLICY intervx_materials_read ON public.incident_materials FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.incidents i WHERE i.id=incident_id));
CREATE POLICY intervx_materials_insert ON public.incident_materials FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR (public.is_approved_field() AND EXISTS
 (SELECT 1 FROM public.incidents i WHERE i.id=incident_id AND i.created_by=auth.uid())));
CREATE POLICY intervx_materials_update ON public.incident_materials FOR UPDATE TO authenticated
USING (public.is_admin() OR (public.is_approved_field() AND EXISTS
 (SELECT 1 FROM public.incidents i WHERE i.id=incident_id AND i.created_by=auth.uid())))
WITH CHECK (public.is_admin() OR (public.is_approved_field() AND EXISTS
 (SELECT 1 FROM public.incidents i WHERE i.id=incident_id AND i.created_by=auth.uid())));
CREATE POLICY intervx_materials_delete ON public.incident_materials FOR DELETE TO authenticated
USING (public.is_admin());
