-- Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  description TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard', 'advanced', 'hardcore')),
  question_count INTEGER NOT NULL DEFAULT 10,
  time_limit_minutes INTEGER DEFAULT 30,
  feedback_form_url TEXT,
  created_by UUID REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view active quizzes
CREATE POLICY "Anyone can view active quizzes" ON public.quizzes
  FOR SELECT USING (is_active = true);

-- Policy: Managers can create quizzes
CREATE POLICY "Managers can create quizzes" ON public.quizzes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- Policy: Managers can update their own quizzes
CREATE POLICY "Managers can update their own quizzes" ON public.quizzes
  FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Managers can delete their own quizzes
CREATE POLICY "Managers can delete their own quizzes" ON public.quizzes
  FOR DELETE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Managers can view all quizzes (including inactive)
CREATE POLICY "Managers can view all quizzes" ON public.quizzes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON public.quizzes(created_by);
CREATE INDEX IF NOT EXISTS idx_quizzes_is_active ON public.quizzes(is_active);
CREATE INDEX IF NOT EXISTS idx_quizzes_topic ON public.quizzes(topic);
CREATE INDEX IF NOT EXISTS idx_quizzes_difficulty ON public.quizzes(difficulty);
