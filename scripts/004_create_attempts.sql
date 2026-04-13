-- Create quiz_attempts table
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  time_taken_seconds INTEGER,
  score INTEGER DEFAULT 0,
  total_questions INTEGER,
  correct_answers INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  answers JSONB, -- [{questionId, selectedOption, isCorrect, timeSpent}]
  points_earned INTEGER DEFAULT 0,
  UNIQUE(quiz_id, user_id)
);

-- Enable RLS
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own attempts
CREATE POLICY "Users can view their own attempts" ON public.quiz_attempts
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can create their own attempts
CREATE POLICY "Users can create their own attempts" ON public.quiz_attempts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own in-progress attempts
CREATE POLICY "Users can update their own attempts" ON public.quiz_attempts
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: Managers can view all attempts for their quizzes
CREATE POLICY "Managers can view all attempts" ON public.quiz_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = quiz_id AND (
        q.created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin'))
      )
    )
  );

-- Policy: Users can view leaderboard (completed attempts)
CREATE POLICY "Users can view completed attempts for leaderboard" ON public.quiz_attempts
  FOR SELECT USING (status = 'completed');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_status ON public.quiz_attempts(status);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_score ON public.quiz_attempts(score DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed_at ON public.quiz_attempts(completed_at);
