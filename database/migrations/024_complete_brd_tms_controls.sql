-- BRD completion pass for SkillTest_AI: Mavericks Execution Platform - TMS.
-- Adds multi-trainer assignment, attendance versioning, assessment governance,
-- project evaluation evidence, admin audit surface, and RLS policies for TMS tables.

CREATE TABLE IF NOT EXISTS public.training_batch_trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.training_batches(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_label TEXT NOT NULL DEFAULT 'Trainer',
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, trainer_id)
);

CREATE INDEX IF NOT EXISTS idx_training_batch_trainers_batch_id
ON public.training_batch_trainers(batch_id);

CREATE INDEX IF NOT EXISTS idx_training_batch_trainers_trainer_id
ON public.training_batch_trainers(trainer_id);

INSERT INTO public.training_batch_trainers(batch_id, trainer_id, role_label, assigned_by)
SELECT id, trainer_id, 'Lead Trainer', created_by
FROM public.training_batches
WHERE trainer_id IS NOT NULL
ON CONFLICT (batch_id, trainer_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.training_batch_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.training_batches(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_batch_change_audit_batch_id
ON public.training_batch_change_audit(batch_id);

CREATE TABLE IF NOT EXISTS public.session_attendance_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES public.session_attendance(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  previous_notes TEXT,
  new_notes TEXT,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS idx_session_attendance_versions_session_user
ON public.session_attendance_versions(session_id, user_id);

CREATE TABLE IF NOT EXISTS public.training_assessment_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.training_batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('sprint_review', 'api_coding', 'coding', 'project', 'other')),
  scheduled_at TIMESTAMPTZ,
  template_name TEXT,
  question_file_name TEXT,
  max_score NUMERIC(8,2) NOT NULL DEFAULT 100,
  passing_score NUMERIC(8,2) NOT NULL DEFAULT 70,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'open', 'completed', 'cancelled')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_assessment_setups_batch_id
ON public.training_assessment_setups(batch_id);

CREATE TABLE IF NOT EXISTS public.training_assessment_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_setup_id UUID REFERENCES public.training_assessment_setups(id) ON DELETE SET NULL,
  batch_id UUID NOT NULL REFERENCES public.training_batches(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT,
  total_records INTEGER NOT NULL DEFAULT 0,
  successful_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,
  duplicate_records INTEGER NOT NULL DEFAULT 0,
  error_log JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_assessment_uploads_batch_id
ON public.training_assessment_uploads(batch_id);

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

CREATE TABLE IF NOT EXISTS public.assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES public.assessment_imports(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  candidate_id TEXT,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  test_id TEXT,
  test_name TEXT,
  test_status TEXT,
  test_link_name TEXT,
  test_score INTEGER,
  candidate_score INTEGER,
  negative_points INTEGER DEFAULT 0,
  percentage DECIMAL(5,2),
  performance_category TEXT,
  percentile INTEGER,
  total_questions INTEGER,
  answered INTEGER,
  not_answered INTEGER,
  correct INTEGER,
  wrong INTEGER,
  test_duration_minutes INTEGER,
  time_taken_minutes DECIMAL(10,2),
  avg_test_time_minutes DECIMAL(10,2),
  completion_time_flag TEXT,
  proctoring_flag TEXT,
  window_violation INTEGER DEFAULT 0,
  time_violation_seconds INTEGER DEFAULT 0,
  invited_by_email TEXT,
  appeared_on TIMESTAMPTZ,
  candidate_feedback TEXT,
  applicant_id TEXT,
  test_navigation_type TEXT,
  section_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_results_quiz_id
ON public.assessment_results(quiz_id);

CREATE INDEX IF NOT EXISTS idx_assessment_results_import_id
ON public.assessment_results(import_id);

CREATE INDEX IF NOT EXISTS idx_assessment_results_candidate_email
ON public.assessment_results(candidate_email);

ALTER TABLE public.assessment_results
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.training_batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assessment_setup_id UUID REFERENCES public.training_assessment_setups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS upload_fingerprint TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_results_unique_upload_fingerprint
ON public.assessment_results(upload_fingerprint)
WHERE upload_fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.training_project_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.training_batches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  project_title TEXT NOT NULL,
  score NUMERIC(8,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  evidence_file_name TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_project_evaluations_batch_id
ON public.training_project_evaluations(batch_id);

CREATE TABLE IF NOT EXISTS public.training_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL CHECK (run_type IN ('attendance_cutoff', 'absence_streak', 'assessment_reminder', 'feedback_reminder')),
  batch_id UUID REFERENCES public.training_batches(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  notifications_created INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  triggered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.training_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.training_feedback
ADD COLUMN IF NOT EXISTS content_quality_rating INTEGER CHECK (content_quality_rating BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS trainer_effectiveness_rating INTEGER CHECK (trainer_effectiveness_rating BETWEEN 1 AND 5);

ALTER TABLE public.training_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_batch_trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assessment_setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assessment_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_project_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "TMS staff can view scoped batches" ON public.training_batches;
CREATE POLICY "TMS staff can view scoped batches" ON public.training_batches
  FOR SELECT USING (
    created_by = auth.uid()
    OR coordinator_id = auth.uid()
    OR trainer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.training_batch_trainers t
      WHERE t.batch_id = training_batches.id AND t.trainer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('training_coordinator', 'manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "Coordinators and admins can manage batches" ON public.training_batches;
CREATE POLICY "Coordinators and admins can manage batches" ON public.training_batches
  FOR ALL USING (
    created_by = auth.uid()
    OR coordinator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('training_coordinator', 'manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "TMS scoped member visibility" ON public.batch_members;
CREATE POLICY "TMS scoped member visibility" ON public.batch_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.training_batches b
      WHERE b.id = batch_members.batch_id
      AND (
        b.created_by = auth.uid()
        OR b.coordinator_id = auth.uid()
        OR b.trainer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.training_batch_trainers t
          WHERE t.batch_id = b.id AND t.trainer_id = auth.uid()
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('training_coordinator', 'manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "TMS scoped session visibility" ON public.training_sessions;
CREATE POLICY "TMS scoped session visibility" ON public.training_sessions
  FOR SELECT USING (
    trainer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.training_batches b
      WHERE b.id = training_sessions.batch_id
      AND (
        b.created_by = auth.uid()
        OR b.coordinator_id = auth.uid()
        OR b.trainer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.training_batch_trainers t
          WHERE t.batch_id = b.id AND t.trainer_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.batch_members m
          WHERE m.batch_id = b.id AND m.user_id = auth.uid()
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('training_coordinator', 'manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "TMS scoped attendance visibility" ON public.session_attendance;
CREATE POLICY "TMS scoped attendance visibility" ON public.session_attendance
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.training_sessions s
      JOIN public.training_batches b ON b.id = s.batch_id
      WHERE s.id = session_attendance.session_id
      AND (
        b.created_by = auth.uid()
        OR b.coordinator_id = auth.uid()
        OR b.trainer_id = auth.uid()
        OR s.trainer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.training_batch_trainers t
          WHERE t.batch_id = b.id AND t.trainer_id = auth.uid()
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('training_coordinator', 'manager', 'admin')
    )
  );
