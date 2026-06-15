-- Admin approval gate for self-service signup.
-- Existing users remain approved; new auth signups start pending until an admin approves them.

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS approval_status text;

UPDATE public.user_profiles p
SET approval_status = 'approved'
WHERE p.approval_status IS NULL;

UPDATE public.user_profiles p
SET name = COALESCE(
  NULLIF(p.name, ''),
  NULLIF(u.raw_user_meta_data->>'name', ''),
  split_part(u.email::text, '@', 1),
  'Utilisateur'
)
FROM auth.users u
WHERE u.id = p.id
  AND NULLIF(p.name, '') IS NULL;

ALTER TABLE public.user_profiles
ALTER COLUMN approval_status SET DEFAULT 'pending';

ALTER TABLE public.user_profiles
ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_approval_status_check;

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_approval_status_check
CHECK (approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));

CREATE INDEX IF NOT EXISTS idx_user_profiles_approval_role
ON public.user_profiles (approval_status, role);

CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid())
      AND approval_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND approval_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_director()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'director'
      AND approval_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_director()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.is_director();
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, role, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email::text, '@', 1), 'Agent terrain'),
    'field',
    'pending'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(NULLIF(public.user_profiles.name, ''), EXCLUDED.name);

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS user_profiles_select_own_or_admin ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_own_field ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_own_name ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_admin_all ON public.user_profiles;

CREATE POLICY user_profiles_select_own_or_admin
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY user_profiles_insert_own_field
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = (SELECT auth.uid())
  AND role = 'field'
  AND approval_status = 'pending'
);

CREATE POLICY user_profiles_admin_all
ON public.user_profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS incidents_field_select_own ON public.incidents;
DROP POLICY IF EXISTS incidents_field_insert_own ON public.incidents;
DROP POLICY IF EXISTS incidents_field_update_own ON public.incidents;
DROP POLICY IF EXISTS incidents_admin_all ON public.incidents;
DROP POLICY IF EXISTS incidents_director_select_all ON public.incidents;

CREATE POLICY incidents_field_select_own
ON public.incidents
FOR SELECT
TO authenticated
USING (public.is_approved_user() AND created_by = (SELECT auth.uid()));

CREATE POLICY incidents_field_insert_own
ON public.incidents
FOR INSERT
TO authenticated
WITH CHECK (public.is_approved_user() AND created_by = (SELECT auth.uid()));

CREATE POLICY incidents_field_update_own
ON public.incidents
FOR UPDATE
TO authenticated
USING (public.is_approved_user() AND created_by = (SELECT auth.uid()))
WITH CHECK (public.is_approved_user() AND created_by = (SELECT auth.uid()));

CREATE POLICY incidents_admin_all
ON public.incidents
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY incidents_director_select_all
ON public.incidents
FOR SELECT
TO authenticated
USING (public.is_director());

DROP FUNCTION IF EXISTS public.get_admin_users();

CREATE FUNCTION public.get_admin_users()
RETURNS TABLE (
  id uuid,
  name text,
  role text,
  email text,
  approval_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only approved administrators can view user profiles.';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    COALESCE(NULLIF(p.name, ''), NULLIF(u.raw_user_meta_data->>'name', ''), split_part(u.email::text, '@', 1), 'Utilisateur') AS name,
    p.role,
    u.email::text,
    p.approval_status
  FROM public.user_profiles p
  JOIN auth.users u ON p.id = u.id
  ORDER BY
    CASE p.approval_status
      WHEN 'pending' THEN 0
      WHEN 'approved' THEN 1
      ELSE 2
    END,
    p.role DESC,
    COALESCE(NULLIF(p.name, ''), NULLIF(u.raw_user_meta_data->>'name', ''), split_part(u.email::text, '@', 1), 'Utilisateur') ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_by_admin(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only approved administrators can delete users.';
  END IF;

  IF user_id = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: You cannot delete your own admin account.';
  END IF;

  DELETE FROM auth.users WHERE id = user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_approved_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_approved_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) TO authenticated;
