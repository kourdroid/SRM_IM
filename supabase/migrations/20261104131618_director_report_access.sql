-- Preserve each report body and archived-row filtering while widening only its role guard.
DO $$
DECLARE v_fn regprocedure; v_def text; v_patched text;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'get_incident_report_summary', 'get_incident_report_breakdowns', 'get_incident_report_rows')
  LOOP
    v_def := pg_get_functiondef(v_fn);
    IF (SELECT p.proname FROM pg_proc p WHERE p.oid = v_fn::oid) = 'get_incident_report_summary' THEN
      v_patched := regexp_replace(v_def,
        'EXISTS\s*\(\s*SELECT 1 FROM public\.user_profiles up\s*WHERE up\.id = auth\.uid\(\) AND up\.role = ''admin''\s*\)',
        'public.is_admin_or_director()');
    ELSE
      v_patched := replace(v_def, 'public.is_admin()', 'public.is_admin_or_director()');
    END IF;
    IF v_patched = v_def THEN RAISE EXCEPTION 'Expected report guard not found in %', v_fn; END IF;
    EXECUTE v_patched;
  END LOOP;
  -- Some projects never received get_incident_report_summary; the next migration creates it when missing.
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN (
        'get_incident_report_breakdowns', 'get_incident_report_rows')) <> 2
  THEN RAISE EXCEPTION 'Expected the breakdowns and rows report functions'; END IF;
END $$;

DROP POLICY IF EXISTS "Admins can create report exports" ON public.report_exports;
CREATE POLICY "Admins and directors can create own report exports"
ON public.report_exports FOR INSERT TO authenticated
WITH CHECK (requested_by = (SELECT auth.uid()) AND public.is_admin_or_director());

DROP POLICY IF EXISTS "Admins can read own report exports" ON public.report_exports;
CREATE POLICY "Admins and directors can read own report exports"
ON public.report_exports FOR SELECT TO authenticated
USING (requested_by = (SELECT auth.uid()) AND public.is_admin_or_director());

CREATE OR REPLACE FUNCTION public.get_supervision_profiles()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id, p.name FROM public.user_profiles p
  WHERE public.is_admin_or_director();
$$;
REVOKE ALL ON FUNCTION public.get_supervision_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supervision_profiles() TO authenticated;
