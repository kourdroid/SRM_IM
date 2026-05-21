-- Safe user management functions for ONEE SRM Administrator
-- Requires pgcrypto extension (enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- RPC to list all users with their emails
CREATE OR REPLACE FUNCTION get_admin_users()
RETURNS TABLE (
  id uuid,
  name text,
  role text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can view user profiles.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.role,
    u.email::text
  FROM public.user_profiles p
  JOIN auth.users u ON p.id = u.id
  ORDER BY p.role DESC, p.name ASC;
END;
$$;

-- RPC to delete a user securely by id
CREATE OR REPLACE FUNCTION delete_user_by_admin(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete users.';
  END IF;

  -- Prevent self-deletion
  IF user_id = auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: You cannot delete your own admin account.';
  END IF;

  -- Delete from auth.users (cascades to user_profiles)
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;
