-- Create questions table
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL, -- [{text: "Option A", isCorrect: false}, ...]
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard', 'advanced', 'hardcore')),
  explanation TEXT,
  is_ai_generated BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT true,
  order_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view approved questions for active quizzes
CREATE POLICY "Users can view approved questions" ON public.questions
  FOR SELECT USING (
    is_approved = true AND
    EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = quiz_id AND q.is_active = true
    )
  );

-- Policy: Managers can view all questions (including unapproved)
CREATE POLICY "Managers can view all questions" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- Policy: Managers can create questions
CREATE POLICY "Managers can create questions" ON public.questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- Policy: Managers can update questions for their quizzes
CREATE POLICY "Managers can update questions" ON public.questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = quiz_id AND (
        q.created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
    )
  );

-- Policy: Managers can delete questions for their quizzes
CREATE POLICY "Managers can delete questions" ON public.questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q 
      WHERE q.id = quiz_id AND (
        q.created_by = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      )
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_is_approved ON public.questions(is_approved);
