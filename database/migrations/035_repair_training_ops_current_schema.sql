-- Repair pass for current Training Ops functionality.
-- Reasserts the columns and CHECK values used by the live UI/actions.
-- Safe to run more than once after migrations 020-034.

BEGIN;

DO $$
DECLARE
  constraint_name text;
BEGIN
  IF to_regclass('public.training_batches') IS NULL THEN
    RAISE EXCEPTION 'training_batches is missing. Run scripts/020_create_training_operations.sql first.';
  END IF;

  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.training_batches'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.training_batches DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

UPDATE public.training_batches
SET status = 'running'
WHERE status IN ('active', 'at_risk');

ALTER TABLE public.training_batches
  ADD CONSTRAINT training_batches_status_check
  CHECK (status IN ('planned', 'running', 'completed', 'closed'));

ALTER TABLE public.batch_members
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.batch_members'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%enrollment_status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.batch_members DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.batch_members
  ADD CONSTRAINT batch_members_enrollment_status_check
  CHECK (enrollment_status IN ('invited', 'active', 'completed', 'dropped', 'discontinued', 'not_cleared', 'offered', 'onboarded'));

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.training_notifications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%delivery_status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.training_notifications DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.training_notifications
  ADD CONSTRAINT training_notifications_delivery_status_check
  CHECK (delivery_status IN ('draft', 'scheduled', 'queued', 'sent', 'failed', 'logged'));

CREATE TABLE IF NOT EXISTS public.training_feedback_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.training_batches(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  opens_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.training_batch_trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.training_batches(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_label TEXT NOT NULL DEFAULT 'Trainer',
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id, trainer_id)
);

CREATE TABLE IF NOT EXISTS public.training_batch_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.training_batches(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_training_project_evaluations_unique_project
ON public.training_project_evaluations(batch_id, user_id, project_title);

CREATE INDEX IF NOT EXISTS idx_batch_members_updated_at ON public.batch_members(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_feedback_windows_batch_id ON public.training_feedback_windows(batch_id);
CREATE INDEX IF NOT EXISTS idx_training_batch_trainers_batch_id ON public.training_batch_trainers(batch_id);
CREATE INDEX IF NOT EXISTS idx_training_batch_change_audit_batch_id ON public.training_batch_change_audit(batch_id);
CREATE INDEX IF NOT EXISTS idx_session_attendance_versions_session_user ON public.session_attendance_versions(session_id, user_id);
CREATE INDEX IF NOT EXISTS idx_training_assessment_setups_batch_id ON public.training_assessment_setups(batch_id);
CREATE INDEX IF NOT EXISTS idx_training_project_evaluations_batch_id ON public.training_project_evaluations(batch_id);

COMMIT;

SELECT 'Training Ops repair migration completed.' AS status;
