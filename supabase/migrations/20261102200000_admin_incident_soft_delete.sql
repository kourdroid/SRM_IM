-- Admin "delete" is a soft delete: archived incidents keep their row, media, materials and audit trail,
-- but disappear from every app surface (admin, director, field sync, reports, notifications).

-- Direct table reads (admin lists, field sync, dashboard_stats_view, media/event policies) go through RLS.
CREATE POLICY intervx_incidents_hide_archived ON public.incidents AS RESTRICTIVE FOR SELECT TO authenticated
USING (archived_at IS NULL);

-- SECURITY DEFINER reporting functions bypass RLS, so they read active rows through this view instead.
CREATE OR REPLACE VIEW private.active_incidents WITH (security_invoker = true) AS
SELECT * FROM public.incidents WHERE archived_at IS NULL;
REVOKE ALL ON private.active_incidents FROM PUBLIC, anon, authenticated;

DO $$
DECLARE v_fn regprocedure; v_def text; v_patched text;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'get_monthly_incidents', 'get_resolution_time_stats',
      'get_director_dashboard_metrics', 'get_director_incidents', 'get_director_incidents_page',
      'get_incident_report_summary', 'get_incident_report_breakdowns', 'get_incident_report_rows')
  LOOP
    v_def := pg_get_functiondef(v_fn);
    v_patched := regexp_replace(v_def, 'public\.incidents\M', 'private.active_incidents', 'g');
    IF v_patched = v_def THEN RAISE EXCEPTION 'Expected % to read public.incidents', v_fn; END IF;
    EXECUTE v_patched;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.archive_incident(p_incident_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Approved admin required' USING ERRCODE = '42501'; END IF;
  UPDATE public.incidents SET archived_at = now(), archived_by = auth.uid(), updated_at = now()
  WHERE id = p_incident_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.incident_events (incident_id, event_type, actor_id, source)
  VALUES (p_incident_id, 'archived', auth.uid(), 'admin_app');
  UPDATE private.admin_notification_deliveries d SET state = 'cancelled', lease_id = NULL, lease_until = NULL
  FROM public.admin_notifications n
  WHERE n.id = d.notification_id AND n.incident_id = p_incident_id
    AND d.state IN ('pending', 'leased') AND d.receipt_id IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.archive_incident(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_incident(uuid) TO authenticated;
