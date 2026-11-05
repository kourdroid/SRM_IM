-- Local isolated database only. Production has these existing tables/functions already.
CREATE TABLE IF NOT EXISTS auth.sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id));
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt()->>'sub')::uuid
$$;
CREATE TABLE public.user_profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), role text, approval_status text);
CREATE TABLE public.communes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type text NOT NULL, incident_type text NOT NULL,
  date timestamptz NOT NULL DEFAULT now(), village text NOT NULL, commune_id uuid REFERENCES public.communes(id),
  equipment_used text NOT NULL,
  created_by uuid REFERENCES auth.users(id), status text NOT NULL DEFAULT 'open',
  depart_hta text, archived_at timestamptz
);
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin' AND approval_status='approved')
$$;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;
