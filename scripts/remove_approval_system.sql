-- Test script to verify removal of approval system
-- Run this in your database to apply the schema changes

-- First, let's check the current state of questions table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'questions' 
  AND table_schema = 'public'
  AND column_name IN ('status', 'is_approved');

-- Remove approval system columns if they exist
DO $$ 
BEGIN
  -- Check if status column exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' 
      AND column_name = 'status' 
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.questions DROP COLUMN status;
  END IF;

  -- Check if is_approved column exists and drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'questions' 
      AND column_name = 'is_approved' 
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.questions DROP COLUMN is_approved;
  END IF;
END $$;

-- Drop index if it exists
DROP INDEX IF EXISTS idx_questions_is_approved;

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view approved questions" ON public.questions;

-- Create new policy for users to view all questions for active quizzes
CREATE POLICY "Users can view questions for active quizzes" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = quiz_id AND q.is_active = true
    )
  );

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'questions' 
  AND table_schema = 'public'
ORDER BY column_name;
