-- Fix RLS policies for managers to properly access data
-- Run this in Supabase SQL Editor

-- Drop and recreate profile viewing policies without self-referencing profiles.
-- Self-referencing profile policies can trigger "infinite recursion detected"
-- when Supabase evaluates SELECT access.
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers and admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view all profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Also add department column if it doesn't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;

-- Create index for department
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department);

-- Verify the policies are correct
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';
