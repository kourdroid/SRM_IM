CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(auth.jwt()->>'sub','')::uuid $$;
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid);
CREATE TABLE public.user_profiles(id uuid PRIMARY KEY,role text,approval_status text);
CREATE TABLE public.incidents(id uuid PRIMARY KEY,status text,archived_at timestamptz,type text,incident_type text,depart_hta text,commune_id uuid,village text,date timestamptz);
CREATE TABLE public.communes(id uuid PRIMARY KEY,name text);
CREATE TABLE public.admin_notifications(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,recipient_id uuid,incident_id uuid,created_at timestamptz DEFAULT now(),acknowledged_at timestamptz,UNIQUE(recipient_id,incident_id));
CREATE TABLE public.admin_push_tokens(token text PRIMARY KEY,user_id uuid,session_id uuid,updated_at timestamptz DEFAULT now());
CREATE TABLE private.admin_notification_deliveries(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,notification_id uuid,token text,kind text,state text DEFAULT 'pending',available_at timestamptz,attempts int DEFAULT 0,receipt_attempts int DEFAULT 0,lease_id uuid,lease_until timestamptz,receipt_id text,sent_at timestamptz,last_error text,UNIQUE(notification_id,token,kind));
CREATE FUNCTION public.is_admin_or_director() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role IN ('admin','director') AND approval_status='approved') $$;
CREATE FUNCTION private.dispatch_admin_notifications() RETURNS void LANGUAGE sql AS $$ SELECT $$;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_notifications_read ON public.admin_notifications FOR SELECT TO authenticated USING (false);
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT ON public.admin_notifications TO authenticated;
\i /workspace/supabase/migrations/20261104131602_director_incident_notifications.sql
CREATE TRIGGER queue_admin_incident_notifications AFTER INSERT ON public.incidents FOR EACH ROW EXECUTE FUNCTION private.queue_admin_incident_notifications();
INSERT INTO public.user_profiles VALUES ('11111111-1111-4111-8111-111111111111','director','approved'),('22222222-2222-4222-8222-222222222222','director','pending'),('33333333-3333-4333-8333-333333333333','field','approved');
INSERT INTO auth.sessions VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',false);
SELECT public.register_admin_push_token('ExpoPushToken[directortesttoken]');
RESET ROLE;
INSERT INTO public.incidents(id,status,type,incident_type,date) VALUES ('44444444-4444-4444-8444-444444444444','open','BT','test',now());
DO $$ BEGIN IF (SELECT count(*) FROM public.admin_notifications)<>1 THEN RAISE EXCEPTION 'recipient eligibility'; END IF; END $$;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',false);
DO $$ BEGIN IF (SELECT count(*) FROM public.claim_admin_notification_deliveries(100))<>1 THEN RAISE EXCEPTION 'director claim'; END IF; END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',false);
DO $$ DECLARE n uuid; BEGIN SELECT id INTO n FROM public.admin_notifications; IF n IS NULL THEN RAISE EXCEPTION 'director read'; END IF; PERFORM public.acknowledge_admin_notification(n); END $$;
RESET ROLE;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.admin_notifications WHERE acknowledged_at IS NOT NULL) THEN RAISE EXCEPTION 'director acknowledge'; END IF; END $$;
SET ROLE authenticated;
DO $$ DECLARE denied_user text; BEGIN
  FOREACH denied_user IN ARRAY ARRAY['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'] LOOP
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',denied_user,'role','authenticated')::text,false);
    IF EXISTS (SELECT 1 FROM public.admin_notifications) THEN RAISE EXCEPTION 'ineligible recipient read'; END IF;
    BEGIN
      PERFORM public.register_admin_push_token('ExpoPushToken[ineligibletesttoken]');
      RAISE EXCEPTION 'ineligible registration';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM public.acknowledge_admin_notification('44444444-4444-4444-8444-444444444444');
      RAISE EXCEPTION 'ineligible acknowledgement';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END LOOP;
END $$;
RESET ROLE;
SELECT 'director notification checks passed';
