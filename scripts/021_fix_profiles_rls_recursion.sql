-- ============================================================
-- 021_fix_profiles_rls_recursion.sql
-- Fix profile SELECT policy recursion that can break login redirects,
-- manager routes, employee dashboards, and profile joins.
-- Safe to re-run in Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers and admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles for leaderboard" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Keep profile reads non-recursive. Manager-only mutations are enforced by
-- server actions/API routes before using the service-role admin client.
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

UPDATE public.profiles
SET role = 'employee'
WHERE role IS NULL OR role = '';

