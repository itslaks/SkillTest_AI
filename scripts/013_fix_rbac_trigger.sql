-- Fix: Update the profile trigger to also UPDATE role if it was missing
-- Run this in Supabase SQL editor

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, employee_id, domain)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'employee'),
    NEW.raw_user_meta_data ->> 'employee_id',
    NEW.raw_user_meta_data ->> 'domain'
  )
  ON CONFLICT (id) DO UPDATE SET
    role = CASE
      WHEN EXCLUDED.role IS NOT NULL AND EXCLUDED.role != ''
      THEN EXCLUDED.role
      ELSE COALESCE(public.profiles.role, 'employee')
    END,
    full_name = CASE
      WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = ''
      THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Also fix any existing profiles that have null role
UPDATE public.profiles
SET role = 'employee'
WHERE role IS NULL OR role = '';

-- RLS: Allow service role to bypass for admin operations
-- (service role key always bypasses RLS automatically)

-- Fix profile SELECT policies without recursively querying profiles.
-- Manager-only write paths are enforced in server code with the service role.
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers and admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);
