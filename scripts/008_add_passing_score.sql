-- Add passing_score column to quizzes table
-- This allows managers to configure custom passing thresholds per quiz
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS passing_score INTEGER DEFAULT 60;

-- Add comment
COMMENT ON COLUMN public.quizzes.passing_score IS 'Minimum score percentage required to pass the quiz (0-100)';
