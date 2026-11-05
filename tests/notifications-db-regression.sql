-- Run after the notification migration. Everything, including pg_net requests, is rolled back.
BEGIN;
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.admin_push_tokens','SELECT') THEN RAISE EXCEPTION 'Push tokens exposed'; END IF;
  IF has_table_privilege('authenticated','public.admin_notifications','UPDATE') THEN RAISE EXCEPTION 'Direct acknowledgement exposed'; END IF;
  IF has_function_privilege('anon','public.register_admin_push_token(text)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous registration exposed'; END IF;
  IF has_function_privilege('authenticated','public.claim_admin_notification_deliveries(integer)','EXECUTE') THEN RAISE EXCEPTION 'Worker claiming exposed'; END IF;
  IF has_function_privilege('authenticated','public.verify_admin_notification_worker(text)','EXECUTE') THEN RAISE EXCEPTION 'Worker authentication exposed'; END IF;
END $$;

INSERT INTO auth.users(id,email) VALUES
 ('11111111-1111-4111-8111-111111111111','notification-admin-a@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','notification-admin-b@example.invalid'),
 ('33333333-3333-4333-8333-333333333333','notification-field@example.invalid');
INSERT INTO public.user_profiles(id,role,approval_status) VALUES
 ('11111111-1111-4111-8111-111111111111','admin','approved'),
 ('22222222-2222-4222-8222-222222222222','director','approved'),
 ('33333333-3333-4333-8333-333333333333','field','approved')
ON CONFLICT (id) DO UPDATE SET role=EXCLUDED.role,approval_status=EXCLUDED.approval_status;
INSERT INTO auth.sessions(id,user_id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","session_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.register_admin_push_token('ExpoPushToken[fieldtesttoken]');
    RAISE EXCEPTION 'Field registration accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.user_profiles SET role='director',approval_status='pending' WHERE id='33333333-3333-4333-8333-333333333333';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.register_admin_push_token('ExpoPushToken[pendingdirector]');
    RAISE EXCEPTION 'Pending director registration accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.user_profiles SET role='field',approval_status='approved' WHERE id='33333333-3333-4333-8333-333333333333';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',true);
SELECT public.register_admin_push_token('ExpoPushToken[admintesttoken1]');
SELECT public.register_admin_push_token('ExpoPushToken[admintesttoken1]');
DO $$ BEGIN
  BEGIN
    PERFORM public.register_admin_push_token('invalid');
    RAISE EXCEPTION 'Malformed token accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',true);
SELECT public.register_admin_push_token('ExpoPushToken[admintesttoken2]');
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO public.incidents(id,type,incident_type,village,status,created_by,date,equipment_used) VALUES
 ('44444444-4444-4444-8444-444444444444','MT','Test notification','Test village','open','33333333-3333-4333-8333-333333333333',now(),'');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.admin_notifications WHERE incident_id='44444444-4444-4444-8444-444444444444') <> (SELECT count(*) FROM public.user_profiles WHERE role IN ('admin','director') AND approval_status='approved') THEN RAISE EXCEPTION 'Expected one alert per approved admin or director'; END IF;
  IF (SELECT count(*) FROM private.admin_notification_deliveries d JOIN public.admin_notifications n ON n.id=d.notification_id WHERE n.incident_id='44444444-4444-4444-8444-444444444444') <> 4 THEN RAISE EXCEPTION 'Expected initial and reminder for each device'; END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
DO $$ DECLARE other_id uuid; BEGIN
  IF (SELECT count(*) FROM public.admin_notifications WHERE incident_id='44444444-4444-4444-8444-444444444444') <> 1 THEN RAISE EXCEPTION 'Alert ownership RLS failed'; END IF;
  BEGIN
    PERFORM public.acknowledge_admin_notification('99999999-9999-4999-8999-999999999999');
    RAISE EXCEPTION 'Foreign acknowledgement accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$ DECLARE expected text; wrong text; BEGIN
  SELECT decrypted_secret INTO expected FROM vault.decrypted_secrets WHERE name='intervx_notification_worker_secret';
  IF expected IS NULL THEN
    IF public.verify_admin_notification_worker(repeat('e',64)) THEN RAISE EXCEPTION 'Unconfigured worker credential accepted'; END IF;
  ELSE
    wrong := CASE WHEN left(expected,1)='0' THEN '1' ELSE '0' END || substr(expected,2);
    IF NOT public.verify_admin_notification_worker(expected) THEN RAISE EXCEPTION 'Valid worker credential rejected'; END IF;
    IF public.verify_admin_notification_worker(wrong) THEN RAISE EXCEPTION 'Wrong worker credential accepted'; END IF;
  END IF;
  IF public.verify_admin_notification_worker(NULL) THEN RAISE EXCEPTION 'Null worker credential accepted'; END IF;
END $$;
CREATE TEMP TABLE claimed_notification_jobs AS SELECT j AS job FROM public.claim_admin_notification_deliveries(100) j;
DO $$ BEGIN
  IF (SELECT count(*) FROM claimed_notification_jobs) <> 2 THEN RAISE EXCEPTION 'Initial claim count incorrect'; END IF;
  IF NOT EXISTS (SELECT 1 FROM claimed_notification_jobs WHERE job->>'recipient_id'='22222222-2222-4222-8222-222222222222') THEN RAISE EXCEPTION 'Director delivery was not claimed'; END IF;
  IF (SELECT count(*) FROM public.claim_admin_notification_deliveries(100)) <> 0 THEN RAISE EXCEPTION 'Concurrent claims duplicated leases'; END IF;
  IF public.finish_admin_notification_delivery((SELECT (job->>'id')::uuid FROM claimed_notification_jobs LIMIT 1),gen_random_uuid(),'{"outcome":"ticket","receipt_id":"wrong"}') THEN RAISE EXCEPTION 'Wrong lease accepted'; END IF;
END $$;
SELECT public.finish_admin_notification_delivery((job->>'id')::uuid,(job->>'lease_id')::uuid,'{"outcome":"ticket","receipt_id":"test-receipt"}') FROM claimed_notification_jobs;
UPDATE private.admin_notification_deliveries SET sent_at=now()-interval '6 minutes' WHERE kind='initial' AND notification_id IN (SELECT id FROM public.admin_notifications WHERE incident_id='44444444-4444-4444-8444-444444444444');
UPDATE private.admin_notification_deliveries SET available_at=now()-interval '1 second' WHERE kind='reminder' AND notification_id IN (SELECT id FROM public.admin_notifications WHERE incident_id='44444444-4444-4444-8444-444444444444');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.claim_admin_notification_deliveries(100)) <> 2 THEN RAISE EXCEPTION 'Reminder claim count incorrect'; END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
SELECT public.acknowledge_admin_notification(id) FROM public.admin_notifications WHERE incident_id='44444444-4444-4444-8444-444444444444';
SELECT public.acknowledge_admin_notification(id) FROM public.admin_notifications WHERE incident_id='44444444-4444-4444-8444-444444444444';
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.admin_notifications WHERE incident_id='44444444-4444-4444-8444-444444444444') <> 1 THEN RAISE EXCEPTION 'Director ownership RLS failed'; END IF;
  BEGIN
    PERFORM public.acknowledge_admin_notification('99999999-9999-4999-8999-999999999999');
    RAISE EXCEPTION 'Director foreign acknowledgement accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT public.acknowledge_admin_notification(id) FROM public.admin_notifications WHERE incident_id='44444444-4444-4444-8444-444444444444';
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM private.admin_notification_deliveries d JOIN public.admin_notifications n ON n.id=d.notification_id WHERE n.recipient_id='11111111-1111-4111-8111-111111111111' AND n.incident_id='44444444-4444-4444-8444-444444444444' AND d.kind='reminder' AND d.state<>'cancelled') THEN RAISE EXCEPTION 'Acknowledgement did not cancel reminder'; END IF;
END $$;
DELETE FROM auth.sessions WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_push_tokens WHERE token='ExpoPushToken[admintesttoken2]') THEN RAISE EXCEPTION 'Revoked session retains push token'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO public.incidents(id,type,incident_type,village,status,created_by,date,equipment_used) VALUES
 ('55555555-5555-4555-8555-555555555555','BT','Test retry','Test village','open','33333333-3333-4333-8333-333333333333',now(),'');
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
TRUNCATE claimed_notification_jobs;
INSERT INTO claimed_notification_jobs SELECT j FROM public.claim_admin_notification_deliveries(100) j;
SELECT public.finish_admin_notification_delivery((job->>'id')::uuid,(job->>'lease_id')::uuid,'{"outcome":"retry","error":"ExpoHTTP503"}') FROM claimed_notification_jobs;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.admin_notification_deliveries WHERE id=(SELECT (job->>'id')::uuid FROM claimed_notification_jobs) AND state='pending' AND available_at>now() AND attempts=1) THEN RAISE EXCEPTION 'Retry backoff not persisted'; END IF;
END $$;
UPDATE private.admin_notification_deliveries SET available_at=now()-interval '1 second' WHERE id=(SELECT (job->>'id')::uuid FROM claimed_notification_jobs);
TRUNCATE claimed_notification_jobs;
INSERT INTO claimed_notification_jobs SELECT j FROM public.claim_admin_notification_deliveries(100) j;
SELECT public.finish_admin_notification_delivery((job->>'id')::uuid,(job->>'lease_id')::uuid,'{"outcome":"failed","error":"InvalidCredentials"}') FROM claimed_notification_jobs;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.admin_notification_deliveries WHERE id=(SELECT (job->>'id')::uuid FROM claimed_notification_jobs) AND state='failed' AND attempts=2) THEN RAISE EXCEPTION 'Permanent failure not persisted'; END IF;
END $$;

INSERT INTO auth.sessions(id,user_id) VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','22222222-2222-4222-8222-222222222222');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","session_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}',true);
SELECT public.register_admin_push_token('ExpoPushToken[admintesttoken1]');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT count(*) FROM public.claim_admin_notification_deliveries(100);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM private.admin_notification_deliveries d JOIN public.admin_notifications n ON n.id=d.notification_id WHERE n.incident_id='55555555-5555-4555-8555-555555555555' AND d.kind='reminder' AND d.state<>'cancelled') THEN RAISE EXCEPTION 'Account switch retains old recipient reminder'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO public.incidents(id,type,incident_type,village,status,created_by,date,equipment_used) VALUES
 ('66666666-6666-4666-8666-666666666666','BT','Test closed','Test village','open','33333333-3333-4333-8333-333333333333',now(),'');
INSERT INTO public.incident_materials(incident_id,client_material_id,material_name,quantity,created_by)
VALUES ('66666666-6666-4666-8666-666666666666','notification-test-material','Test material',1,'33333333-3333-4333-8333-333333333333');
UPDATE public.incidents SET status='closed' WHERE id='66666666-6666-4666-8666-666666666666';
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.claim_admin_notification_deliveries(100)) <> 0 THEN RAISE EXCEPTION 'Closed incident notification claimed'; END IF;
END $$;
ROLLBACK;
