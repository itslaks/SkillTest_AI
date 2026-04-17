-- Remove approval system from questions table
-- This script removes the status and is_approved columns from questions table
-- and updates the RLS policies accordingly

-- Drop existing indexes related to approval
DROP INDEX IF EXISTS idx_questions_is_approved;

-- Remove the status and is_approved columns
ALTER TABLE public.questions 
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS is_approved;

-- Update RLS policy to remove approval filter
-- Drop the old policy
DROP POLICY IF EXISTS "Users can view approved questions" ON public.questions;

-- Create new policy for users to view all questions for active quizzes
CREATE POLICY "Users can view questions for active quizzes" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = quiz_id AND q.is_active = true
    )
  );

-- The manager policies remain the same as they already allow viewing all questions
-- No need to update those
