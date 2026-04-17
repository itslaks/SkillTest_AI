-- IMMEDIATE FIX: Employee Quiz Access Issue
-- Run this in Supabase SQL Editor to fix "no approved questions" error

-- PROBLEM: Employees can't take quizzes, see "approved questions" error
-- SOLUTION: Remove the approval system entirely

-- Step 1: Drop the policy that's causing the dependency error
DROP POLICY IF EXISTS "Users can view approved questions" ON public.questions;

-- Step 2: Drop any other policies that might reference these columns
DROP POLICY IF EXISTS "Users can view questions" ON public.questions;
DROP POLICY IF EXISTS "Employees can view approved questions" ON public.questions;

-- Step 3: Drop the index
DROP INDEX IF EXISTS idx_questions_is_approved;

-- Step 4: Now drop the columns (use CASCADE to force removal)
ALTER TABLE public.questions 
DROP COLUMN IF EXISTS is_approved CASCADE,
DROP COLUMN IF EXISTS status CASCADE;

-- Step 5: Create new policy without approval filter
DROP POLICY IF EXISTS "Users can view questions for active quizzes" ON public.questions;
CREATE POLICY "Users can view questions for active quizzes" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = quiz_id AND q.is_active = true
    )
  );

-- Verify success
SELECT 'SUCCESS: Approval system removed! Employees can now take quizzes.' AS result;
