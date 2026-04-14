-- Create quiz_assignments table to track which quizzes are assigned to which employees
CREATE TABLE IF NOT EXISTS public.quiz_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  UNIQUE(quiz_id, user_id)
);

-- Enable RLS
ALTER TABLE public.quiz_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Employees can view their own assignments
CREATE POLICY "Employees can view their own assignments" ON public.quiz_assignments
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Managers can view all assignments for quizzes they created
CREATE POLICY "Managers can view assignments for their quizzes" ON public.quiz_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- Policy: Managers can create assignments (assigned_by must be the current user)
CREATE POLICY "Managers can create assignments" ON public.quiz_assignments
  FOR INSERT WITH CHECK (
    assigned_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- Policy: Managers can delete assignments
CREATE POLICY "Managers can delete assignments" ON public.quiz_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- Indexes for performance with 1000+ users
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_user_id ON public.quiz_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_quiz_id ON public.quiz_assignments(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_assigned_by ON public.quiz_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_user_quiz ON public.quiz_assignments(user_id, quiz_id);
