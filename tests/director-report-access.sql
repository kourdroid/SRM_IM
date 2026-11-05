-- Local-only authorization canary; all fixture writes are rolled back.
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('a1111111-1111-4111-8111-111111111111','reports-admin@example.invalid'),
 ('a2222222-2222-4222-8222-222222222222','reports-director@example.invalid'),
 ('a3333333-3333-4333-8333-333333333333','reports-pending@example.invalid'),
 ('a4444444-4444-4444-8444-444444444444','reports-field@example.invalid');
INSERT INTO public.user_profiles(id,name,role,approval_status) VALUES
 ('a1111111-1111-4111-8111-111111111111','Reports admin','admin','approved'),
 ('a2222222-2222-4222-8222-222222222222','Reports director','director','approved'),
 ('a3333333-3333-4333-8333-333333333333','Reports pending','director','pending'),
 ('a4444444-4444-4444-8444-444444444444','Reports field','field','approved')
ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role, approval_status=EXCLUDED.approval_status;
INSERT INTO public.incidents(id,type,incident_type,village,status,created_by,date,equipment_used,created_at,archived_at) VALUES
 ('a5555555-5555-4555-8555-555555555555','BT','Report canary','Report canary','open','a4444444-4444-4444-8444-444444444444',now(),'','2099-01-01T10:00:00Z',NULL),
 ('a6666666-6666-4666-8666-666666666666','BT','Report canary','Report canary','open','a4444444-4444-4444-8444-444444444444',now(),'','2099-01-01T10:00:00Z',now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
CREATE TEMP TABLE report_baseline AS SELECT
 public.get_incident_report_summary('2099-01-01','2099-01-02') AS summary,
 public.get_incident_report_breakdowns('2099-01-01','2099-01-02') AS breakdown;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.get_incident_report_rows('2099-01-01','2099-01-02') WHERE id='a5555555-5555-4555-8555-555555555555') OR
    EXISTS (SELECT 1 FROM public.get_incident_report_rows('2099-01-01','2099-01-02') WHERE id='a6666666-6666-4666-8666-666666666666') THEN RAISE EXCEPTION 'Admin report rows or archive filtering failed'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
DO $$ BEGIN
 IF (SELECT summary FROM report_baseline) <> public.get_incident_report_summary('2099-01-01','2099-01-02') OR
    (SELECT breakdown FROM report_baseline) <> public.get_incident_report_breakdowns('2099-01-01','2099-01-02') OR
    NOT EXISTS (SELECT 1 FROM public.get_incident_report_rows('2099-01-01','2099-01-02') WHERE id='a5555555-5555-4555-8555-555555555555') OR
    EXISTS (SELECT 1 FROM public.get_incident_report_rows('2099-01-01','2099-01-02') WHERE id='a6666666-6666-4666-8666-666666666666') THEN RAISE EXCEPTION 'Director report differs from admin or includes archived rows'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.get_supervision_profiles() WHERE id='a4444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Director cannot resolve profile name'; END IF;
 INSERT INTO public.report_exports(requested_by,start_date,end_date,format) VALUES ('a2222222-2222-4222-8222-222222222222','2099-01-01','2099-01-01','xlsx');
 IF NOT EXISTS (SELECT 1 FROM public.report_exports WHERE requested_by=auth.uid()) THEN RAISE EXCEPTION 'Director cannot read own export'; END IF;
 BEGIN
  INSERT INTO public.report_exports(requested_by,start_date,end_date,format) VALUES ('a1111111-1111-4111-8111-111111111111','2099-01-01','2099-01-01','xlsx');
  RAISE EXCEPTION 'Director created another user export';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"a3333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.get_supervision_profiles()) OR EXISTS (SELECT 1 FROM public.report_exports) THEN RAISE EXCEPTION 'Pending director read privileged data'; END IF;
 BEGIN PERFORM public.get_incident_report_summary('2099-01-01','2099-01-02'); RAISE EXCEPTION 'Pending director got a summary';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_incident_report_breakdowns('2099-01-01','2099-01-02'); RAISE EXCEPTION 'Pending director got breakdowns';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.get_incident_report_rows('2099-01-01','2099-01-02'); RAISE EXCEPTION 'Pending director got rows';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.report_exports(requested_by,start_date,end_date,format) VALUES (auth.uid(),'2099-01-01','2099-01-01','xlsx');
  RAISE EXCEPTION 'Pending director created export';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"a4444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.get_supervision_profiles()) OR EXISTS (SELECT 1 FROM public.report_exports) THEN RAISE EXCEPTION 'Field user read privileged data'; END IF;
 BEGIN PERFORM public.get_incident_report_summary('2099-01-01','2099-01-02'); RAISE EXCEPTION 'Field user got a summary';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.get_incident_report_breakdowns('2099-01-01','2099-01-02'); RAISE EXCEPTION 'Field user got breakdowns';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.get_incident_report_rows('2099-01-01','2099-01-02'); RAISE EXCEPTION 'Field user got rows';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.report_exports(requested_by,start_date,end_date,format) VALUES (auth.uid(),'2099-01-01','2099-01-01','xlsx');
  RAISE EXCEPTION 'Field user created export';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
