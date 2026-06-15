-- Editable field reference data and Excel report export support.
-- Reference values are deactivated instead of deleted so incident history remains reportable.

CREATE TABLE IF NOT EXISTS public.incident_type_options (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  network_type text NOT NULL CHECK (network_type IN ('BT', 'MT')),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.depart_hta_options (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_type_options_network_name_unique
  ON public.incident_type_options (network_type, lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_incident_type_options_active_sort
  ON public.incident_type_options (network_type, active, sort_order, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_depart_hta_options_name_unique
  ON public.depart_hta_options (lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_depart_hta_options_active_sort
  ON public.depart_hta_options (active, sort_order, name);

ALTER TABLE public.incident_type_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.depart_hta_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incident_type_options_read ON public.incident_type_options;
CREATE POLICY incident_type_options_read
ON public.incident_type_options
FOR SELECT
TO authenticated
USING (active OR public.is_admin());

DROP POLICY IF EXISTS incident_type_options_admin_insert ON public.incident_type_options;
CREATE POLICY incident_type_options_admin_insert
ON public.incident_type_options
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS incident_type_options_admin_update ON public.incident_type_options;
CREATE POLICY incident_type_options_admin_update
ON public.incident_type_options
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS depart_hta_options_read ON public.depart_hta_options;
CREATE POLICY depart_hta_options_read
ON public.depart_hta_options
FOR SELECT
TO authenticated
USING (active OR public.is_admin());

DROP POLICY IF EXISTS depart_hta_options_admin_insert ON public.depart_hta_options;
CREATE POLICY depart_hta_options_admin_insert
ON public.depart_hta_options
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS depart_hta_options_admin_update ON public.depart_hta_options;
CREATE POLICY depart_hta_options_admin_update
ON public.depart_hta_options
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

GRANT SELECT ON public.incident_type_options TO authenticated;
GRANT SELECT ON public.depart_hta_options TO authenticated;

INSERT INTO public.incident_type_options (network_type, name, sort_order)
VALUES
  ('BT', 'Manque phase', 10),
  ('BT', 'Manque deux phases', 20),
  ('BT', 'Manque trois phases', 30),
  ('BT', 'Manque neutre', 40),
  ('BT', 'Manque tension', 50),
  ('BT', 'Chute de tension', 60),
  ('BT', 'Court-circuit', 70),
  ('BT', 'Câble à la terre', 80),
  ('BT', 'Câble par terre / chute de câble', 90),
  ('BT', 'Déclenchement disjoncteur BT', 100),
  ('BT', 'Bouclage phases', 110),
  ('BT', 'Amorçage', 120),
  ('BT', 'Remplacement transformateur', 130),
  ('BT', 'Tirage câble BT', 140),
  ('BT', 'Accident routier (dommage réseau)', 150),
  ('BT', 'Autre', 160),
  ('MT', 'Câble conducteur cisaillé', 10),
  ('MT', 'Déclenchement départ HTA', 20),
  ('MT', 'Manque tension HTA', 30),
  ('MT', 'Remplacement transformateur HTA', 40),
  ('MT', 'Bretelle rompu', 50),
  ('MT', 'Bretelles rompues', 60),
  ('MT', 'Câble rompu', 70),
  ('MT', 'Transformateur avarié', 80),
  ('MT', 'Cellule préfabriquée avariée', 90),
  ('MT', 'Parafoudre avarié', 100),
  ('MT', 'Amorçage', 110),
  ('MT', 'Amorçage Cellule Préfabriquée', 120),
  ('MT', 'Autre', 130)
ON CONFLICT DO NOTHING;

INSERT INTO public.depart_hta_options (name, sort_order)
VALUES
  ('Oualidia - Rural', 10),
  ('Oualidia - Zemamra', 20),
  ('Oualidia - Centre', 30),
  ('Oualidia - Beddouza', 40),
  ('Oualidia - Moul lbergui', 50),
  ('Sidi bennou - Sidi Smail', 60),
  ('Sidi bennour - Centre 1', 70),
  ('Sidi bennour - Centre 2', 80),
  ('Sidi bennour - Laaounate', 90),
  ('Sidi bennour - RTM', 100),
  ('Sidi bennour - Bir Laabid', 110),
  ('Sidi bennour - Od amrane', 120),
  ('Sidi bennour - Od frej', 130),
  ('Sidi bennour - Sucrerie', 140),
  ('Sidi bennour - Zemamra', 150),
  ('Sidi bennour - Khmis ksiba', 160),
  ('Youssoufia -Hormat ALLH', 170),
  ('Zemamra - Centre', 180),
  ('Zemamra - Z1Z2', 190),
  ('Zemamra - Z0', 200),
  ('Zemamra - Z3', 210),
  ('Zemamra - Elgharbia', 220),
  ('Zemamra - Sebt sais', 230),
  ('Zemamra - Sidi bennour', 240),
  ('Zemamra - Oualidia', 250),
  ('Zemamra - Sucrerie', 260)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_admin_incident_type_options()
RETURNS TABLE (
  id uuid,
  network_type text,
  name text,
  active boolean,
  sort_order integer,
  incident_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can manage incident types.';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.network_type,
    o.name,
    o.active,
    o.sort_order,
    count(i.id)::bigint AS incident_count
  FROM public.incident_type_options o
  LEFT JOIN public.incidents i
    ON i.type = o.network_type
   AND lower(trim(i.incident_type)) = lower(trim(o.name))
  GROUP BY o.id, o.network_type, o.name, o.active, o.sort_order
  ORDER BY o.network_type ASC, o.sort_order ASC, o.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_incident_type_options() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_incident_type_option_by_admin(
  p_network_type text,
  p_name text
)
RETURNS TABLE (
  id uuid,
  network_type text,
  name text,
  active boolean,
  sort_order integer,
  incident_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_network_type text := upper(trim(p_network_type));
  v_name text := trim(p_name);
  v_sort_order integer;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can create incident types.';
  END IF;

  IF v_network_type NOT IN ('BT', 'MT') THEN
    RAISE EXCEPTION 'Network type must be BT or MT.';
  END IF;
  IF v_name IS NULL OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'Incident type name is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('incident-type:' || v_network_type || ':' || lower(v_name)));

  IF EXISTS (
    SELECT 1 FROM public.incident_type_options o
    WHERE o.network_type = v_network_type
      AND lower(trim(o.name)) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'Incident type already exists: %', v_name;
  END IF;

  SELECT COALESCE(max(sort_order), 0) + 10
  INTO v_sort_order
  FROM public.incident_type_options
  WHERE network_type = v_network_type;

  INSERT INTO public.incident_type_options (network_type, name, sort_order)
  VALUES (v_network_type, v_name, v_sort_order)
  RETURNING public.incident_type_options.id INTO v_id;

  RETURN QUERY
  SELECT v_id, v_network_type, v_name, true, v_sort_order, 0::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.create_incident_type_option_by_admin(text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.update_incident_type_option_by_admin(
  p_id uuid,
  p_network_type text,
  p_name text,
  p_active boolean,
  p_sort_order integer
)
RETURNS TABLE (
  id uuid,
  network_type text,
  name text,
  active boolean,
  sort_order integer,
  incident_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_network_type text := upper(trim(p_network_type));
  v_name text := trim(p_name);
  v_incident_count bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update incident types.';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Incident type id is required.';
  END IF;
  IF v_network_type NOT IN ('BT', 'MT') THEN
    RAISE EXCEPTION 'Network type must be BT or MT.';
  END IF;
  IF v_name IS NULL OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'Incident type name is required.';
  END IF;

  SELECT count(i.id)::bigint
  INTO v_incident_count
  FROM public.incident_type_options o
  JOIN public.incidents i
    ON i.type = o.network_type
   AND lower(trim(i.incident_type)) = lower(trim(o.name))
  WHERE o.id = p_id;

  IF v_incident_count > 0 THEN
    UPDATE public.incident_type_options o
    SET active = COALESCE(p_active, o.active),
        sort_order = COALESCE(p_sort_order, o.sort_order),
        updated_at = now()
    WHERE o.id = p_id;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.incident_type_options o
      WHERE o.id <> p_id
        AND o.network_type = v_network_type
        AND lower(trim(o.name)) = lower(v_name)
    ) THEN
      RAISE EXCEPTION 'Incident type already exists: %', v_name;
    END IF;

    UPDATE public.incident_type_options o
    SET network_type = v_network_type,
        name = v_name,
        active = COALESCE(p_active, o.active),
        sort_order = COALESCE(p_sort_order, o.sort_order),
        updated_at = now()
    WHERE o.id = p_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident type not found.';
  END IF;

  RETURN QUERY
  SELECT
    item.id,
    item.network_type,
    item.name,
    item.active,
    item.sort_order,
    item.incident_count
  FROM public.get_admin_incident_type_options() item
  WHERE item.id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_incident_type_option_by_admin(uuid, text, text, boolean, integer) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_admin_depart_hta_options()
RETURNS TABLE (
  id uuid,
  name text,
  active boolean,
  sort_order integer,
  incident_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can manage Départs HTA.';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.active,
    o.sort_order,
    count(i.id)::bigint AS incident_count
  FROM public.depart_hta_options o
  LEFT JOIN public.incidents i
    ON lower(trim(i.depart_hta)) = lower(trim(o.name))
  GROUP BY o.id, o.name, o.active, o.sort_order
  ORDER BY o.sort_order ASC, o.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_depart_hta_options() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_depart_hta_option_by_admin(p_name text)
RETURNS TABLE (
  id uuid,
  name text,
  active boolean,
  sort_order integer,
  incident_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := trim(p_name);
  v_sort_order integer;
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can create Départs HTA.';
  END IF;
  IF v_name IS NULL OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'Départ HTA name is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('depart-hta:' || lower(v_name)));

  IF EXISTS (
    SELECT 1 FROM public.depart_hta_options o
    WHERE lower(trim(o.name)) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'Départ HTA already exists: %', v_name;
  END IF;

  SELECT COALESCE(max(sort_order), 0) + 10 INTO v_sort_order FROM public.depart_hta_options;

  INSERT INTO public.depart_hta_options (name, sort_order)
  VALUES (v_name, v_sort_order)
  RETURNING public.depart_hta_options.id INTO v_id;

  RETURN QUERY
  SELECT v_id, v_name, true, v_sort_order, 0::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.create_depart_hta_option_by_admin(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.update_depart_hta_option_by_admin(
  p_id uuid,
  p_name text,
  p_active boolean,
  p_sort_order integer
)
RETURNS TABLE (
  id uuid,
  name text,
  active boolean,
  sort_order integer,
  incident_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := trim(p_name);
  v_incident_count bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update Départs HTA.';
  END IF;
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Départ HTA id is required.';
  END IF;
  IF v_name IS NULL OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'Départ HTA name is required.';
  END IF;

  SELECT count(i.id)::bigint
  INTO v_incident_count
  FROM public.depart_hta_options o
  JOIN public.incidents i
    ON lower(trim(i.depart_hta)) = lower(trim(o.name))
  WHERE o.id = p_id;

  IF v_incident_count > 0 THEN
    UPDATE public.depart_hta_options o
    SET active = COALESCE(p_active, o.active),
        sort_order = COALESCE(p_sort_order, o.sort_order),
        updated_at = now()
    WHERE o.id = p_id;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.depart_hta_options o
      WHERE o.id <> p_id
        AND lower(trim(o.name)) = lower(v_name)
    ) THEN
      RAISE EXCEPTION 'Départ HTA already exists: %', v_name;
    END IF;

    UPDATE public.depart_hta_options o
    SET name = v_name,
        active = COALESCE(p_active, o.active),
        sort_order = COALESCE(p_sort_order, o.sort_order),
        updated_at = now()
    WHERE o.id = p_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Départ HTA not found.';
  END IF;

  RETURN QUERY
  SELECT
    item.id,
    item.name,
    item.active,
    item.sort_order,
    item.incident_count
  FROM public.get_admin_depart_hta_options() item
  WHERE item.id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_depart_hta_option_by_admin(uuid, text, boolean, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_admin_incident_type_options() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_incident_type_option_by_admin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_incident_type_option_by_admin(uuid, text, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_depart_hta_options() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_depart_hta_option_by_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_depart_hta_option_by_admin(uuid, text, boolean, integer) TO authenticated;

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  IF to_regclass('public.report_exports') IS NULL THEN
    RETURN;
  END IF;

  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.report_exports'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%format%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.report_exports DROP CONSTRAINT %I', v_constraint_name);
  END IF;

  ALTER TABLE public.report_exports
    ADD CONSTRAINT report_exports_format_check CHECK (format IN ('csv', 'xlsx'));
END;
$$;
