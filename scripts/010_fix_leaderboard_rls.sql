-- ============================================================
-- 010_fix_leaderboard_rls.sql
-- Fix RLS policies so employees can view leaderboard profiles
-- and managers can export results properly
-- Safe to re-run
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX 1: Allow all authenticated users to view basic profile info
-- (needed for leaderboards)
-- ─────────────────────────────────────────────────────────────

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers and admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles for leaderboard" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- New policy: Any authenticated user can view any profile (needed for leaderboards)
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Keep update restricted to own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- FIX 2: Ensure user_stats is viewable by all authenticated users
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can view all stats for leaderboard" ON public.user_stats;
DROP POLICY IF EXISTS "Authenticated users can view all stats" ON public.user_stats;

-- Any authenticated user can view all stats (for leaderboard)
CREATE POLICY "Authenticated users can view all stats" ON public.user_stats
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can still only update/insert their own stats
DROP POLICY IF EXISTS "Users can update their own stats" ON public.user_stats;
CREATE POLICY "Users can update their own stats" ON public.user_stats
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own stats" ON public.user_stats;
CREATE POLICY "Users can insert their own stats" ON public.user_stats
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- FIX 3: Ensure quiz_attempts can be viewed for leaderboard
-- ─────────────────────────────────────────────────────────────

-- Drop existing SELECT policies and recreate cleaner ones
DROP POLICY IF EXISTS "Users can view their own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Managers can view all attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can view completed attempts for leaderboard" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Authenticated users can view completed attempts" ON public.quiz_attempts;

-- Users can view their own attempts (any status)
CREATE POLICY "Users can view their own attempts" ON public.quiz_attempts
  FOR SELECT USING (user_id = auth.uid());

-- Any authenticated user can view completed attempts (for quiz leaderboards)
CREATE POLICY "Authenticated users can view completed attempts" ON public.quiz_attempts
  FOR SELECT USING (auth.uid() IS NOT NULL AND status = 'completed');

-- Managers can view ALL attempts for quizzes they created
CREATE POLICY "Managers can view all attempts" ON public.quiz_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- DONE
-- ─────────────────────────────────────────────────────────────
