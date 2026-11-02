-- Every canary mutation is rolled back. Never run the local fixture on production.
BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('91111111-1111-4111-8111-111111111111','atomic-admin@example.invalid'),
 ('92222222-2222-4222-8222-222222222222','atomic-director@example.invalid'),
 ('93333333-3333-4333-8333-333333333333','atomic-field@example.invalid');
INSERT INTO public.user_profiles(id,name,role,approval_status) VALUES
 ('91111111-1111-4111-8111-111111111111','Atomic admin','admin','approved'),
 ('92222222-2222-4222-8222-222222222222','Atomic director','director','approved'),
 ('93333333-3333-4333-8333-333333333333','Atomic field','field','approved')
ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role,approval_status=EXCLUDED.approval_status;
INSERT INTO public.incidents(id,type,incident_type,village,status,created_by,date,equipment_used,created_at) VALUES
 ('94444444-4444-4444-8444-444444444444','MT','Atomic test','Atomic canary village','open','93333333-3333-4333-8333-333333333333',now(),'','2026-10-26T10:00:00Z'),
 ('95555555-5555-4555-8555-555555555555','BT','Atomic test','Atomic canary village','open','93333333-3333-4333-8333-333333333333',now(),'','2026-10-26T10:00:00Z');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"93333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.close_incident_with_materials('94444444-4444-4444-8444-444444444444','[{"client_material_id":"wire","material_name":"Cable","quantity":10}]');
    RAISE EXCEPTION 'Field user can use admin closure';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"91111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.close_incident_with_materials('94444444-4444-4444-8444-444444444444','[{"client_material_id":"wire","material_name":"Cable","quantity":10},{"client_material_id":"bad","material_name":"Bad","quantity":0}]');
    RAISE EXCEPTION 'Invalid quantity accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF EXISTS(SELECT 1 FROM public.incident_materials WHERE incident_id='94444444-4444-4444-8444-444444444444') THEN RAISE EXCEPTION 'Rejected materials left partial writes'; END IF;
  BEGIN
    PERFORM public.close_incident_with_materials('94444444-4444-4444-8444-444444444444','[{"client_material_id":"wire","material_name":"Cable","quantity":"NaN"}]');
    RAISE EXCEPTION 'Non-numeric quantity accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
SELECT public.close_incident_with_materials('94444444-4444-4444-8444-444444444444','[{"client_material_id":"wire","material_name":"Cable","quantity":10}]');
SELECT public.close_incident_with_materials('94444444-4444-4444-8444-444444444444','[{"client_material_id":"wire","material_name":"Cable","quantity":100}]');
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.incidents WHERE id='94444444-4444-4444-8444-444444444444' AND status='closed' AND equipment_used='Cable x10') THEN RAISE EXCEPTION 'Closure summary loses trailing zero or retry edits materials'; END IF;
  IF (SELECT quantity FROM public.incident_materials WHERE incident_id='94444444-4444-4444-8444-444444444444')<>10 THEN RAISE EXCEPTION 'Retry modified successful closure'; END IF;
  IF (SELECT materials_summary FROM public.get_incident_report_rows('2026-10-26','2026-10-27') WHERE id='94444444-4444-4444-8444-444444444444')<>'Cable x10' THEN RAISE EXCEPTION 'Report quantity formatting failed'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"92222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
DO $$ DECLARE first_id uuid; second_id uuid; BEGIN
  SELECT id INTO first_id FROM public.get_director_incidents_page(1,NULL,NULL,NULL,NULL,'Atomic canary village');
  SELECT id INTO second_id FROM public.get_director_incidents_page(1,'2026-10-26T10:00:00Z',first_id,NULL,NULL,'Atomic canary village');
  IF first_id<>'95555555-5555-4555-8555-555555555555' OR second_id<>'94444444-4444-4444-8444-444444444444' THEN RAISE EXCEPTION 'Timestamp tie pagination skipped a record'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Atomic closure, quantity, role and pagination checks passed; all canaries rolled back' AS result;
