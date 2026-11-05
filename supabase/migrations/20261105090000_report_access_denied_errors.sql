-- The report functions used to hide the role check inside their WHERE clause, so a caller without
-- access got a valid-looking all-zero report instead of an error. Keep the existing implementations
-- (and their archived-row filtering) in the private schema and put a thin guard in front of them
-- that raises when the caller is not an approved admin or director.
-- Some projects never received the summary function (the app then rebuilds it client-side from all rows).
-- Create it when missing; it reads active (non-archived) incidents like its siblings.
DO $$
BEGIN
  IF to_regprocedure('public.get_incident_report_summary(timestamptz,timestamptz,uuid,uuid,text,text,boolean)') IS NULL THEN
    CREATE FUNCTION public.get_incident_report_summary(
      p_start_date timestamp with time zone,
      p_end_date timestamp with time zone,
      p_commune_id uuid DEFAULT NULL,
      p_agent_id uuid DEFAULT NULL,
      p_type text DEFAULT NULL,
      p_status text DEFAULT NULL,
      p_reclamation boolean DEFAULT NULL
    ) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
      WITH filtered AS (
        SELECT * FROM private.active_incidents i
        WHERE i.created_at >= p_start_date
          AND i.created_at < p_end_date
          AND public.is_admin_or_director()
          AND (p_commune_id IS NULL OR i.commune_id = p_commune_id)
          AND (p_agent_id IS NULL OR i.created_by = p_agent_id)
          AND (p_type IS NULL OR i.type = p_type)
          AND (p_status IS NULL OR i.status = p_status)
          AND (p_reclamation IS NULL OR i.reclamation = p_reclamation)
      )
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'open', COUNT(*) FILTER (WHERE status = 'open'),
        'closed', COUNT(*) FILTER (WHERE status = 'closed'),
        'reclamations', COUNT(*) FILTER (WHERE reclamation = true),
        'bt', COUNT(*) FILTER (WHERE type = 'BT'),
        'mt', COUNT(*) FILTER (WHERE type = 'MT'),
        'missingGps', COUNT(*) FILTER (WHERE latitude IS NULL OR longitude IS NULL),
        'missingPhoto', COUNT(*) FILTER (WHERE media_urls IS NULL OR cardinality(media_urls) = 0),
        'avgClosureDays', COALESCE(AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400) FILTER (WHERE closed_at IS NOT NULL), 0),
        'maxClosureDays', COALESCE(MAX(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400) FILTER (WHERE closed_at IS NOT NULL), 0)
      ) FROM filtered;
    $fn$;
  END IF;
END $$;

DO $$
DECLARE
  r record;
  v_args text;
  v_result text;
  v_call text;
  v_body text;
  v_inner regprocedure;
  v_outer regprocedure;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, p.proargnames[1:p.pronargs] AS proargnames
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'get_incident_report_summary', 'get_incident_report_breakdowns', 'get_incident_report_rows')
  LOOP
    v_args := pg_get_function_arguments(r.oid);
    v_result := pg_get_function_result(r.oid);
    SELECT string_agg(quote_ident(a), ', ' ORDER BY ord) INTO v_call
    FROM unnest(r.proargnames) WITH ORDINALITY AS t(a, ord);

    EXECUTE format('ALTER FUNCTION %s SET SCHEMA private', r.oid::regprocedure);
    v_inner := r.oid::regprocedure;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_inner);

    IF v_result LIKE 'TABLE(%' THEN
      v_body := format('RETURN QUERY SELECT * FROM private.%I(%s);', r.proname, v_call);
    ELSE
      v_body := format('RETURN private.%I(%s);', r.proname, v_call);
    END IF;

    EXECUTE format($fn$
      CREATE FUNCTION public.%I(%s) RETURNS %s
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
      BEGIN
        IF NOT public.is_admin_or_director() THEN
          RAISE EXCEPTION 'Unauthorized: admin or director access required.' USING ERRCODE = '42501';
        END IF;
        %s
      END $body$;
    $fn$, r.proname, v_args, v_result, v_body);

    SELECT p.oid::regprocedure INTO v_outer
    FROM pg_proc p WHERE p.proname = r.proname AND p.pronamespace = 'public'::regnamespace;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_outer);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_outer);
  END LOOP;

  IF (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN (
        'get_incident_report_summary', 'get_incident_report_breakdowns', 'get_incident_report_rows')) <> 3
     OR (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'private'::regnamespace AND p.proname IN (
        'get_incident_report_summary', 'get_incident_report_breakdowns', 'get_incident_report_rows')) <> 3
  THEN RAISE EXCEPTION 'Expected three guarded and three private report functions'; END IF;
END $$;

NOTIFY pgrst, 'reload schema';
