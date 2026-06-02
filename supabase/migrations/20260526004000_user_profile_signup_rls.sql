-- Reliable profile creation for signup/admin-created users.
-- The client must not directly create its own user_profiles row after auth.signUp.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email::text, '@', 1), 'Agent terrain'),
    'field'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(public.user_profiles.name, EXCLUDED.name);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;

CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user_profile();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_select_own_or_admin ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert_own_field ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update_own_name ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_admin_all ON public.user_profiles;

CREATE POLICY user_profiles_select_own_or_admin
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin());

CREATE POLICY user_profiles_insert_own_field
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() AND role = 'field');

CREATE POLICY user_profiles_update_own_name
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid() AND role = 'field');

CREATE POLICY user_profiles_admin_all
ON public.user_profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
