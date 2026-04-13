-- Create badges table
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  criteria JSONB, -- {type: 'score', threshold: 90} or {type: 'streak', count: 5}
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on badges
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- Everyone can view badges
CREATE POLICY "Anyone can view badges" ON public.badges
  FOR SELECT USING (true);

-- Only admins can modify badges
CREATE POLICY "Admins can modify badges" ON public.badges
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Create user_badges table
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Enable RLS on user_badges
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Users can view their own badges
CREATE POLICY "Users can view their own badges" ON public.user_badges
  FOR SELECT USING (user_id = auth.uid());

-- Users can view all badges for leaderboard/social features
CREATE POLICY "Users can view all earned badges" ON public.user_badges
  FOR SELECT USING (true);

-- System can award badges (via trigger or service role)
CREATE POLICY "System can award badges" ON public.user_badges
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create user_stats table
CREATE TABLE IF NOT EXISTS public.user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  total_points INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  tests_completed INTEGER DEFAULT 0,
  average_score DECIMAL(5,2) DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_stats
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

-- Users can view their own stats
CREATE POLICY "Users can view their own stats" ON public.user_stats
  FOR SELECT USING (user_id = auth.uid());

-- Users can view all stats for leaderboard
CREATE POLICY "Users can view all stats for leaderboard" ON public.user_stats
  FOR SELECT USING (true);

-- Users can update their own stats
CREATE POLICY "Users can update their own stats" ON public.user_stats
  FOR UPDATE USING (user_id = auth.uid());

-- Users can insert their own stats
CREATE POLICY "Users can insert their own stats" ON public.user_stats
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create employee_imports table
CREATE TABLE IF NOT EXISTS public.employee_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES public.profiles(id),
  file_name TEXT,
  total_records INTEGER,
  successful_imports INTEGER,
  failed_imports INTEGER,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_log JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on employee_imports
ALTER TABLE public.employee_imports ENABLE ROW LEVEL SECURITY;

-- Managers can view their own imports
CREATE POLICY "Managers can view their own imports" ON public.employee_imports
  FOR SELECT USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Managers can create imports
CREATE POLICY "Managers can create imports" ON public.employee_imports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- Managers can update their own imports
CREATE POLICY "Managers can update their own imports" ON public.employee_imports
  FOR UPDATE USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON public.user_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_total_points ON public.user_stats(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_employee_imports_uploaded_by ON public.employee_imports(uploaded_by);
