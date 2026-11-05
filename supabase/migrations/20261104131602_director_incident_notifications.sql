-- Directors receive the same incident notifications, without other admin permissions.
DROP POLICY admin_notifications_read ON public.admin_notifications;
CREATE POLICY admin_notifications_read ON public.admin_notifications FOR SELECT TO authenticated
USING (recipient_id = (SELECT auth.uid()) AND public.is_admin_or_director());

CREATE OR REPLACE FUNCTION public.register_admin_push_token(p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_director() THEN
    RAISE EXCEPTION 'Approved administrator or director required' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.acknowledge_admin_notification(p_notification_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_director() THEN
    RAISE EXCEPTION 'Approved administrator or director required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.admin_notifications SET acknowledged_at=coalesce(acknowledged_at,now())
  WHERE id=p_notification_id AND recipient_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Notification unavailable' USING ERRCODE = '42501'; END IF;
  UPDATE private.admin_notification_deliveries SET state='cancelled',lease_id=NULL,lease_until=NULL
  WHERE notification_id=p_notification_id AND state IN ('pending','leased') AND receipt_id IS NULL;
END $$;

CREATE OR REPLACE FUNCTION private.queue_admin_incident_notifications() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status <> 'open' OR NEW.archived_at IS NOT NULL THEN RETURN NEW; END IF;
  INSERT INTO public.admin_notifications(recipient_id,incident_id)
  SELECT id,NEW.id FROM public.user_profiles WHERE role IN ('admin','director') AND approval_status='approved'
  ON CONFLICT DO NOTHING;
  INSERT INTO private.admin_notification_deliveries(notification_id,token,kind,available_at)
  SELECT n.id,t.token,k.kind,now() + CASE WHEN k.kind='reminder' THEN interval '5 minutes' ELSE interval '0' END
  FROM public.admin_notifications n JOIN public.admin_push_tokens t ON t.user_id=n.recipient_id
  CROSS JOIN (VALUES ('initial'),('reminder')) AS k(kind)
  WHERE n.incident_id=NEW.id ON CONFLICT DO NOTHING;
  PERFORM private.dispatch_admin_notifications();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.claim_admin_notification_deliveries(p_limit integer DEFAULT 100) RETURNS SETOF jsonb
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
      AND i.status='open' AND i.archived_at IS NULL AND p.role IN ('admin','director') AND p.approval_status='approved'
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

