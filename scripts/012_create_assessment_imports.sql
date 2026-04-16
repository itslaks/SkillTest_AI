-- Create assessment_imports table to store imported assessment data
CREATE TABLE IF NOT EXISTS public.assessment_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.profiles(id),
  file_name TEXT,
  total_records INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create assessment_results table to store individual assessment records
CREATE TABLE IF NOT EXISTS public.assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES public.assessment_imports(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  
  -- Candidate Info
  candidate_id TEXT,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  
  -- Test Info
  test_id TEXT,
  test_name TEXT,
  test_status TEXT,
  test_link_name TEXT,
  
  -- Scoring
  test_score INTEGER,
  candidate_score INTEGER,
  negative_points INTEGER DEFAULT 0,
  percentage DECIMAL(5,2),
  performance_category TEXT,
  percentile INTEGER,
  
  -- Questions
  total_questions INTEGER,
  answered INTEGER,
  not_answered INTEGER,
  correct INTEGER,
  wrong INTEGER,
  
  -- Time
  test_duration_minutes INTEGER,
  time_taken_minutes DECIMAL(10,2),
  avg_test_time_minutes DECIMAL(10,2),
  completion_time_flag TEXT,
  
  -- Proctoring
  proctoring_flag TEXT,
  window_violation INTEGER DEFAULT 0,
  time_violation_seconds INTEGER DEFAULT 0,
  
  -- Other
  invited_by_email TEXT,
  appeared_on TIMESTAMPTZ,
  candidate_feedback TEXT,
  applicant_id TEXT,
  test_navigation_type TEXT,
  
  -- Section specific data (JSON for flexibility)
  section_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_assessment_results_quiz_id ON public.assessment_results(quiz_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_import_id ON public.assessment_results(import_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_candidate_email ON public.assessment_results(candidate_email);

-- Create ai_chat_sessions table for manager AI Q&A
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL,
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ai_chat_messages table for chat history
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for chat messages
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id ON public.ai_chat_messages(session_id);

-- Enable RLS
ALTER TABLE public.assessment_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assessment_imports
CREATE POLICY "Managers can view their own imports" ON public.assessment_imports
  FOR SELECT USING (uploaded_by = auth.uid());

CREATE POLICY "Managers can create imports" ON public.assessment_imports
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Managers can update their own imports" ON public.assessment_imports
  FOR UPDATE USING (uploaded_by = auth.uid());

-- RLS Policies for assessment_results
CREATE POLICY "Managers can view results for their imports" ON public.assessment_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assessment_imports ai
      WHERE ai.id = assessment_results.import_id
      AND ai.uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Managers can insert results for their imports" ON public.assessment_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assessment_imports ai
      WHERE ai.id = assessment_results.import_id
      AND ai.uploaded_by = auth.uid()
    )
  );

-- Employees can view their own results
CREATE POLICY "Employees can view their own results" ON public.assessment_results
  FOR SELECT USING (
    candidate_email = (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for ai_chat_sessions
CREATE POLICY "Users can manage their own chat sessions" ON public.ai_chat_sessions
  FOR ALL USING (user_id = auth.uid());

-- RLS Policies for ai_chat_messages
CREATE POLICY "Users can manage messages in their sessions" ON public.ai_chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.ai_chat_sessions s
      WHERE s.id = ai_chat_messages.session_id
      AND s.user_id = auth.uid()
    )
  );
