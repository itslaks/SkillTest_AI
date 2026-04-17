-- 015: Remove approval system from questions table (Robust Version)
-- This script safely removes the approval system by handling dependencies in the correct order

-- STEP 1: First, check what policies exist
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'questions' 
  AND schemaname = 'public';

-- STEP 2: Drop all RLS policies that might reference the approval columns
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    -- Get all policies on the questions table that reference the columns we want to drop
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'questions' 
          AND schemaname = 'public'
          AND (qual LIKE '%is_approved%' OR qual LIKE '%status%')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.questions';
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- STEP 3: Drop specific policies by name (backup approach)
DROP POLICY IF EXISTS "Users can view approved questions" ON public.questions;
DROP POLICY IF EXISTS "Users can view questions" ON public.questions;
DROP POLICY IF EXISTS "Employees can view approved questions" ON public.questions;

-- STEP 4: Drop indexes
DROP INDEX IF EXISTS idx_questions_is_approved;
DROP INDEX IF EXISTS idx_questions_status;

-- STEP 5: Now safely drop the columns
ALTER TABLE public.questions 
DROP COLUMN IF EXISTS status CASCADE,
DROP COLUMN IF EXISTS is_approved CASCADE;

-- STEP 6: Create the new simplified policy
-- First drop if exists to ensure clean state
DROP POLICY IF EXISTS "Users can view questions for active quizzes" ON public.questions;

CREATE POLICY "Users can view questions for active quizzes" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = quiz_id AND q.is_active = true
    )
  );

-- STEP 7: Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'questions' 
  AND table_schema = 'public'
  AND column_name IN ('status', 'is_approved');

-- STEP 8: Show remaining policies
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename = 'questions' 
  AND schemaname = 'public';

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Approval system successfully removed from questions table!';
END $$;
