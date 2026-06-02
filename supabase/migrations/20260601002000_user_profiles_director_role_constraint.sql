-- Allow the read-only director role in user profiles.
-- Previous production schemas only allowed field/admin through user_profiles_role_check.

ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_role_check
CHECK (role = ANY (ARRAY['field'::text, 'admin'::text, 'director'::text]));
