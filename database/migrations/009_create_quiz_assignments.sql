-- ============================================================
-- 009_create_quiz_assignments.sql
-- Safe to re-run: uses IF NOT EXISTS + DROP POLICY IF EXISTS
-- ============================================================

-- 1. Create table (idempotent)
CREATE TABLE IF NOT EXISTS public.quiz_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ,
  UNIQUE(quiz_id, user_id)
);

-- 2. Enable RLS
ALTER TABLE public.quiz_assignments ENABLE ROW LEVEL SECURITY;

-- 3. Drop all existing policies first (safe if they don't exist)
DROP POLICY IF EXISTS "Employees can view their own assignments" ON public.quiz_assignments;
DROP POLICY IF EXISTS "Managers can view assignments for their quizzes" ON public.quiz_assignments;
DROP POLICY IF EXISTS "Managers can create assignments" ON public.quiz_assignments;
DROP POLICY IF EXISTS "Managers can delete assignments" ON public.quiz_assignments;

-- 4. Recreate policies

-- Employees can only see quizzes assigned to them
CREATE POLICY "Employees can view their own assignments" ON public.quiz_assignments
  FOR SELECT USING (user_id = auth.uid());

-- Managers/admins can see all assignments
CREATE POLICY "Managers can view assignments for their quizzes" ON public.quiz_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- Managers/admins can insert assignments (assigned_by must be themselves)
CREATE POLICY "Managers can create assignments" ON public.quiz_assignments
  FOR INSERT WITH CHECK (
    assigned_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- Managers/admins can remove assignments
CREATE POLICY "Managers can delete assignments" ON public.quiz_assignments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- 5. Indexes for performance with 1000+ users (idempotent)
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_user_id ON public.quiz_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_quiz_id ON public.quiz_assignments(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_assigned_by ON public.quiz_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_user_quiz ON public.quiz_assignments(user_id, quiz_id);
