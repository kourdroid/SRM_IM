-- The dashboard now shows minutes and hours, so one-decimal days (0.1 day = 2.4 h) are too coarse.
CREATE OR REPLACE FUNCTION public.get_resolution_time_stats()
RETURNS TABLE(avg_days numeric, max_days numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF NOT public.is_admin_or_director() THEN RAISE EXCEPTION 'Approved admin or director required' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT avg(extract(epoch FROM (i.closed_at-i.created_at))/86400)::numeric,
    max(extract(epoch FROM (i.closed_at-i.created_at))/86400)::numeric
  FROM private.active_incidents i WHERE i.status='closed' AND i.closed_at IS NOT NULL AND i.created_at >= now()-interval '30 days';
END $function$;
