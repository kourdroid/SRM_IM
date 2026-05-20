-- Dashboard Stats Materialization

CREATE OR REPLACE VIEW dashboard_stats_view AS
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'open') as open,
  COUNT(*) FILTER (WHERE status = 'closed') as closed,
  COUNT(*) FILTER (WHERE reclamation = true) as reclamations
FROM incidents;

-- Monthly Incidents Chart Data
CREATE OR REPLACE FUNCTION get_monthly_incidents(target_year int)
RETURNS TABLE (label text, value bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_char(date_trunc('month', created_at), 'Mon') as label,
    count(*) as value
  FROM incidents
  WHERE extract(year from created_at) = target_year
  GROUP BY date_trunc('month', created_at)
  ORDER BY date_trunc('month', created_at);
END;
$$;
