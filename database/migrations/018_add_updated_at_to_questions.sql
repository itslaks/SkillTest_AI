-- 018: Add updated_at column to questions table for better tracking
-- This script adds the updated_at column to questions table and creates a trigger to auto-update it

-- Add the updated_at column to questions table
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create or update the trigger function for questions updated_at
CREATE OR REPLACE FUNCTION public.update_questions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create the trigger for questions table
DROP TRIGGER IF EXISTS update_questions_updated_at_trigger ON public.questions;
CREATE TRIGGER update_questions_updated_at_trigger
  BEFORE UPDATE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_questions_updated_at();

-- Update existing records to have the current timestamp
UPDATE public.questions 
SET updated_at = created_at 
WHERE updated_at IS NULL;
