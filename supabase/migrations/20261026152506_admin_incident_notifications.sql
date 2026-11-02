-- Notification delivery is independent of field synchronization and never calls HTTP synchronously.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE FUNCTION public.verify_admin_notification_worker(p_secret text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_expected text;
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Worker access required' USING ERRCODE = '42501';
  END IF;
  IF p_secret IS NULL OR p_secret !~ '^[a-f0-9]{64}$' THEN RETURN false; END IF;
  SELECT decrypted_secret INTO v_expected FROM vault.decrypted_secrets WHERE name='intervx_notification_worker_secret';
  RETURN v_expected IS NOT NULL AND extensions.digest(p_secret,'sha256')=extensions.digest(v_expected,'sha256');
END $$;
REVOKE ALL ON FUNCTION public.verify_admin_notification_worker(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_notification_worker(text) TO service_role;

CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  UNIQUE (recipient_id, incident_id)
);
CREATE INDEX admin_notifications_recipient_created ON public.admin_notifications(recipient_id, created_at DESC, id DESC);
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
CREATE POLICY admin_notifications_read ON public.admin_notifications FOR SELECT TO authenticated
USING (recipient_id = (SELECT auth.uid()) AND public.is_admin());

CREATE TABLE public.admin_push_tokens (
  token text PRIMARY KEY CHECK (token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$'),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_push_tokens_user ON public.admin_push_tokens(user_id);
ALTER TABLE public.admin_push_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_push_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_push_tokens TO service_role;

CREATE TABLE private.admin_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.admin_notifications(id) ON DELETE CASCADE,
  token text NOT NULL REFERENCES public.admin_push_tokens(token) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('initial', 'reminder')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','leased','receipt_pending','provider_accepted','failed','cancelled')),
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  receipt_attempts integer NOT NULL DEFAULT 0,
  lease_id uuid,
  lease_until timestamptz,
  receipt_id text,
  sent_at timestamptz,
  last_error text,
  UNIQUE (notification_id, token, kind)
);
CREATE INDEX admin_notification_deliveries_due ON private.admin_notification_deliveries(available_at) WHERE state IN ('pending','receipt_pending','leased');
ALTER TABLE private.admin_notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.admin_notification_deliveries FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.register_admin_push_token(p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Approved administrator required' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$' THEN
    RAISE EXCEPTION 'Invalid push token' USING ERRCODE = '22023';
  END IF;
  v_session := nullif(auth.jwt()->>'session_id', '')::uuid;
  IF NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = v_session AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Active session required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.admin_push_tokens(token,user_id,session_id)
  VALUES (p_token,auth.uid(),v_session)
  ON CONFLICT (token) DO UPDATE SET user_id=EXCLUDED.user_id,session_id=EXCLUDED.session_id,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.register_admin_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_admin_push_token(text) TO authenticated;

CREATE FUNCTION public.unregister_admin_push_token(p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.admin_push_tokens WHERE token=p_token AND user_id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.unregister_admin_push_token(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unregister_admin_push_token(text) TO authenticated;

CREATE FUNCTION public.acknowledge_admin_notification(p_notification_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Approved administrator required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.admin_notifications SET acknowledged_at=coalesce(acknowledged_at,now())
  WHERE id=p_notification_id AND recipient_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Notification unavailable' USING ERRCODE = '42501'; END IF;
  UPDATE private.admin_notification_deliveries SET state='cancelled',lease_id=NULL,lease_until=NULL
  WHERE notification_id=p_notification_id AND state IN ('pending','leased') AND receipt_id IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.acknowledge_admin_notification(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_admin_notification(uuid) TO authenticated;

CREATE FUNCTION private.dispatch_admin_notifications() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_secret text; v_url text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.admin_notification_deliveries
    WHERE state IN ('pending','receipt_pending','leased') AND available_at <= now()) THEN RETURN; END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='intervx_notification_worker_secret';
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name='intervx_notification_project_url';
  IF v_secret IS NULL OR v_url IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url:=rtrim(v_url,'/') || '/functions/v1/send-incident-notifications',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_secret),
    body:='{}'::jsonb, timeout_milliseconds:=10000);
EXCEPTION WHEN OTHERS THEN
  -- The durable queue remains available to the next scheduled attempt.
  RAISE WARNING 'Notification dispatcher deferred (%)', SQLSTATE;
END $$;
REVOKE ALL ON FUNCTION private.dispatch_admin_notifications() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.queue_admin_incident_notifications() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status <> 'open' OR NEW.archived_at IS NOT NULL THEN RETURN NEW; END IF;
  INSERT INTO public.admin_notifications(recipient_id,incident_id)
  SELECT id,NEW.id FROM public.user_profiles WHERE role='admin' AND approval_status='approved'
  ON CONFLICT DO NOTHING;
  INSERT INTO private.admin_notification_deliveries(notification_id,token,kind,available_at)
  SELECT n.id,t.token,k.kind,now() + CASE WHEN k.kind='reminder' THEN interval '5 minutes' ELSE interval '0' END
  FROM public.admin_notifications n JOIN public.admin_push_tokens t ON t.user_id=n.recipient_id
  CROSS JOIN (VALUES ('initial'),('reminder')) AS k(kind)
  WHERE n.incident_id=NEW.id ON CONFLICT DO NOTHING;
  PERFORM private.dispatch_admin_notifications();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.queue_admin_incident_notifications() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER queue_admin_incident_notifications AFTER INSERT ON public.incidents
FOR EACH ROW EXECUTE FUNCTION private.queue_admin_incident_notifications();

-- Only the authenticated worker can claim jobs or record provider results.
CREATE FUNCTION public.claim_admin_notification_deliveries(p_limit integer DEFAULT 100) RETURNS SETOF jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Worker access required' USING ERRCODE = '42501';
  END IF;
  UPDATE private.admin_notification_deliveries d SET state='cancelled',lease_id=NULL,lease_until=NULL
  WHERE d.state IN ('pending','leased') AND d.receipt_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.admin_notifications n
    JOIN public.incidents i ON i.id=n.incident_id
    JOIN public.user_profiles p ON p.id=n.recipient_id
    JOIN public.admin_push_tokens t ON t.token=d.token AND t.user_id=n.recipient_id
    JOIN auth.sessions s ON s.id=t.session_id AND s.user_id=t.user_id
    WHERE n.id=d.notification_id AND n.acknowledged_at IS NULL
      AND n.created_at > now()-interval '24 hours'
      AND i.status='open' AND i.archived_at IS NULL AND p.role='admin' AND p.approval_status='approved'
  );
  UPDATE private.admin_notification_deliveries SET state='failed',last_error='AttemptsExhausted'
  WHERE ((receipt_id IS NULL AND attempts>=5) OR (receipt_id IS NOT NULL AND receipt_attempts>=12))
    AND (state IN ('pending','receipt_pending') OR (state='leased' AND lease_until<=now()));
  RETURN QUERY
  WITH candidates AS (
    SELECT d.id FROM private.admin_notification_deliveries d
    WHERE (d.state IN ('pending','receipt_pending') OR (d.state='leased' AND d.lease_until<=now()))
      AND d.available_at<=now()
      AND (d.kind='initial' OR d.receipt_id IS NOT NULL OR EXISTS (
        SELECT 1 FROM private.admin_notification_deliveries initial
        WHERE initial.notification_id=d.notification_id AND initial.token=d.token AND initial.kind='initial'
          AND initial.receipt_id IS NOT NULL AND initial.sent_at<=now()-interval '5 minutes'))
    ORDER BY d.available_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT greatest(1,least(p_limit,100))
  ), claimed AS (
    UPDATE private.admin_notification_deliveries d SET state='leased',lease_id=gen_random_uuid(),
      lease_until=now()+interval '2 minutes',
      attempts=d.attempts+CASE WHEN receipt_id IS NULL THEN 1 ELSE 0 END,
      receipt_attempts=d.receipt_attempts+CASE WHEN receipt_id IS NOT NULL THEN 1 ELSE 0 END
    FROM candidates c WHERE d.id=c.id RETURNING d.*
  )
  SELECT jsonb_build_object('id',d.id,'lease_id',d.lease_id,'token',d.token,'kind',d.kind,
    'attempts',d.attempts,'receipt_attempts',d.receipt_attempts,'receipt_id',d.receipt_id,
    'notification_id',n.id,'recipient_id',n.recipient_id,'incident_id',i.id,
    'type',i.type,'incident_type',i.incident_type,'depart_hta',i.depart_hta,
    'commune',c.name,'village',i.village,'reported_at',i.date)
  FROM claimed d JOIN public.admin_notifications n ON n.id=d.notification_id
  JOIN public.incidents i ON i.id=n.incident_id LEFT JOIN public.communes c ON c.id=i.commune_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_admin_notification_deliveries(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin_notification_deliveries(integer) TO service_role;

CREATE FUNCTION public.finish_admin_notification_delivery(p_id uuid,p_lease_id uuid,p_result jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_job private.admin_notification_deliveries; v_outcome text:=p_result->>'outcome';
BEGIN
  IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'Worker access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_job FROM private.admin_notification_deliveries
  WHERE id=p_id AND lease_id=p_lease_id AND state='leased' FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_outcome='invalid_token' THEN
    DELETE FROM public.admin_push_tokens WHERE token=v_job.token;
    RETURN true;
  ELSIF v_outcome='ticket' THEN
    IF nullif(p_result->>'receipt_id','') IS NULL THEN RAISE EXCEPTION 'Receipt ID required'; END IF;
    UPDATE private.admin_notification_deliveries SET state='receipt_pending',receipt_id=p_result->>'receipt_id',
      sent_at=now(),available_at=now()+interval '15 minutes',lease_id=NULL,lease_until=NULL,last_error=NULL WHERE id=p_id;
  ELSIF v_outcome='provider_accepted' THEN
    UPDATE private.admin_notification_deliveries SET state='provider_accepted',lease_id=NULL,lease_until=NULL,last_error=NULL WHERE id=p_id;
  ELSIF v_outcome IN ('retry','failed') THEN
    UPDATE private.admin_notification_deliveries SET state=CASE WHEN v_outcome='failed' THEN 'failed'
      WHEN receipt_id IS NULL THEN 'pending' ELSE 'receipt_pending' END,
      available_at=now()+make_interval(secs=>least(3600,30*power(2,least(greatest(attempts,receipt_attempts),7)))::integer),
      last_error=left(coalesce(p_result->>'error','UnknownError'),100),lease_id=NULL,lease_until=NULL WHERE id=p_id;
  ELSE RAISE EXCEPTION 'Invalid outcome' USING ERRCODE='22023'; END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.finish_admin_notification_delivery(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_admin_notification_delivery(uuid,uuid,jsonb) TO service_role;

SELECT cron.schedule('intervx-admin-notifications','* * * * *',$cron$SELECT private.dispatch_admin_notifications();$cron$);
