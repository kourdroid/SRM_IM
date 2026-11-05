-- Run inside BEGIN ... ROLLBACK, after the hardening migration.
SELECT set_config('intervx.test.field', (SELECT id::text FROM public.user_profiles WHERE role='field' AND approval_status='approved' LIMIT 1), true);
SELECT set_config('intervx.test.admin', (SELECT id::text FROM public.user_profiles WHERE role='admin' AND approval_status='approved' LIMIT 1), true);
SELECT set_config('intervx.test.director', COALESCE((SELECT id::text FROM public.user_profiles WHERE role='director' AND approval_status='approved' LIMIT 1),''), true);
SELECT set_config('intervx.test.commune', (SELECT id::text FROM public.communes LIMIT 1), true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('intervx.test.field'), true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
DO $$ DECLARE rows_changed integer; BEGIN
  IF NOT public.is_approved_field() THEN RAISE EXCEPTION 'Approved field fixture missing'; END IF;
  BEGIN
    UPDATE public.user_profiles SET role='admin' WHERE id=auth.uid();
    RAISE EXCEPTION 'Self role escalation was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.user_profiles SET approval_status='rejected' WHERE id=auth.uid();
    RAISE EXCEPTION 'Self approval mutation was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  IF EXISTS (SELECT 1 FROM public.incidents WHERE created_by IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Field caller can read foreign incidents';
  END IF;
  BEGIN
    PERFORM public.get_monthly_incidents(2026);
    RAISE EXCEPTION 'Field caller can read global monthly metrics';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.get_resolution_time_stats();
    RAISE EXCEPTION 'Field caller can read global resolution metrics';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.archive_incident('00000000-0000-4000-8000-000000000099');
    RAISE EXCEPTION 'Field caller can archive incidents';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO public.incidents (id,client_id,type,date,village,incident_type,commune_id,equipment_used,created_by)
  VALUES ('00000000-0000-4000-8000-000000000099','intervx-regression-20261014','BT',now(),'Synthetic regression','Synthetic regression',
    current_setting('intervx.test.commune')::uuid,'',auth.uid());
  IF NOT public.can_write_incident_media('incidents/00000000-0000-4000-8000-000000000099/test.jpg') THEN
    RAISE EXCEPTION 'Field owner cannot upload own photo'; END IF;
  IF public.can_write_incident_media('incidents/00000000-0000-4000-8000-000000000098/test.jpg') THEN
    RAISE EXCEPTION 'Field caller can upload foreign photo'; END IF;
  IF public.can_write_incident_media('incidents/00000000-0000-4000-8000-000000000099/../test.jpg') THEN
    RAISE EXCEPTION 'Storage path traversal allowed'; END IF;
  BEGIN
    PERFORM public.append_incident_media('00000000-0000-4000-8000-000000000098','test',
      'incidents/00000000-0000-4000-8000-000000000098/test.jpg','https://example.invalid/test.jpg');
    RAISE EXCEPTION 'Foreign media attachment allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.upsert_incident_materials('00000000-0000-4000-8000-000000000099',
    '[{"client_material_id":"intervx-regression","material_name":"Synthetic cable","quantity":1}]'::jsonb);
  UPDATE public.incidents SET status='closed' WHERE id='00000000-0000-4000-8000-000000000099';
  GET DIAGNOSTICS rows_changed = ROW_COUNT;
  IF rows_changed <> 1 THEN RAISE EXCEPTION 'Field owner cannot close own incident with materials'; END IF;
END $$;

-- Unknown/unapproved identity must have no incident access or privileged writes.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000097',true);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.incidents) THEN RAISE EXCEPTION 'Unapproved caller can read incidents'; END IF;
  IF public.can_write_incident_media('incidents/00000000-0000-4000-8000-000000000099/test.jpg') THEN
    RAISE EXCEPTION 'Unapproved caller can upload'; END IF;
  BEGIN
    PERFORM public.archive_incident('00000000-0000-4000-8000-000000000099');
    RAISE EXCEPTION 'Unapproved caller can archive';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claim.sub',current_setting('intervx.test.admin'),true);
DO $$ BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Approved admin fixture missing'; END IF;
  PERFORM public.get_monthly_incidents(2026);
  PERFORM public.get_resolution_time_stats();
  IF NOT EXISTS (SELECT 1 FROM public.incidents WHERE id='00000000-0000-4000-8000-000000000099') THEN
    RAISE EXCEPTION 'Admin cannot read field incident'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub',current_setting('intervx.test.director'),true);
DO $$ DECLARE changed integer; BEGIN
  IF current_setting('intervx.test.director') <> '' THEN
    IF NOT public.is_director() THEN RAISE EXCEPTION 'Director fixture invalid'; END IF;
    PERFORM public.get_monthly_incidents(2026);
    UPDATE public.incidents SET description='Should not change' WHERE id='00000000-0000-4000-8000-000000000099';
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 0 THEN RAISE EXCEPTION 'Director can mutate incidents'; END IF;
  END IF;
END $$;
RESET ROLE;
SELECT 'PASS: authorization assertions completed; enclosing transaction must roll back' AS result;
