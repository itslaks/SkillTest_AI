-- Normalize quiz proctoring sessions, events, evidence, and review state.
-- Run after 037_add_proctoring_risk_engine.sql.

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS proctoring_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.quizzes
  ALTER COLUMN proctoring_required SET DEFAULT FALSE;

UPDATE public.quizzes
SET proctoring_required = FALSE
WHERE proctoring_required IS NULL;

ALTER TABLE public.quizzes
  ALTER COLUMN proctoring_required SET NOT NULL;

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'under_review', 'approved', 'rejected', 'retest_required', 'escalated')),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_notes TEXT,
  ADD COLUMN IF NOT EXISTS review_decision TEXT;

CREATE TABLE IF NOT EXISTS public.proctoring_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  camera_ready BOOLEAN NOT NULL DEFAULT FALSE,
  microphone_ready BOOLEAN NOT NULL DEFAULT FALSE,
  fullscreen_ready BOOLEAN NOT NULL DEFAULT FALSE,
  consent_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'auto_submitted', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id)
);

CREATE TABLE IF NOT EXISTS public.quiz_proctoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  severity TEXT CHECK (severity IS NULL OR severity IN ('low', 'medium', 'high', 'critical')),
  risk_score INTEGER NOT NULL DEFAULT 0,
  question_number INTEGER,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quiz_proctoring_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.quiz_proctoring_events(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  storage_path TEXT,
  mime_type TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_attempt_id ON public.proctoring_sessions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_employee_id ON public.proctoring_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_quiz_id ON public.proctoring_sessions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_status ON public.proctoring_sessions(status);

CREATE INDEX IF NOT EXISTS idx_quiz_proctoring_events_session_id ON public.quiz_proctoring_events(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_proctoring_events_attempt_id ON public.quiz_proctoring_events(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_proctoring_events_employee_id ON public.quiz_proctoring_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_quiz_proctoring_events_quiz_id ON public.quiz_proctoring_events(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_proctoring_events_occurred_at ON public.quiz_proctoring_events(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_proctoring_evidence_event_id ON public.quiz_proctoring_evidence(event_id);
CREATE INDEX IF NOT EXISTS idx_quiz_proctoring_evidence_session_id ON public.quiz_proctoring_evidence(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_proctoring_evidence_attempt_id ON public.quiz_proctoring_evidence(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_proctoring_evidence_employee_id ON public.quiz_proctoring_evidence(employee_id);
CREATE INDEX IF NOT EXISTS idx_quiz_proctoring_evidence_quiz_id ON public.quiz_proctoring_evidence(quiz_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_review_status ON public.quiz_attempts(review_status);

ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_proctoring_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_proctoring_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees can read own proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Employees can read own proctoring sessions" ON public.proctoring_sessions
  FOR SELECT USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "Employees can create own proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Employees can create own proctoring sessions" ON public.proctoring_sessions
  FOR INSERT WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "Training staff can read scoped proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Training staff can read scoped proctoring sessions" ON public.proctoring_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('trainer', 'training_staff', 'training_coordinator', 'manager', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = proctoring_sessions.quiz_id
        AND q.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.quizzes q
      JOIN public.training_batch_trainers tbt ON tbt.batch_id = q.batch_id
      WHERE q.id = proctoring_sessions.quiz_id
        AND tbt.trainer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Training staff can update proctoring sessions" ON public.proctoring_sessions;
CREATE POLICY "Training staff can update proctoring sessions" ON public.proctoring_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('trainer', 'training_staff', 'training_coordinator', 'manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "Employees can create own proctoring events" ON public.quiz_proctoring_events;
CREATE POLICY "Employees can create own proctoring events" ON public.quiz_proctoring_events
  FOR INSERT WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "Training staff can read scoped proctoring events" ON public.quiz_proctoring_events;
CREATE POLICY "Training staff can read scoped proctoring events" ON public.quiz_proctoring_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('trainer', 'training_staff', 'training_coordinator', 'manager', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_proctoring_events.quiz_id
        AND q.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.quizzes q
      JOIN public.training_batch_trainers tbt ON tbt.batch_id = q.batch_id
      WHERE q.id = quiz_proctoring_events.quiz_id
        AND tbt.trainer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Training staff can read scoped proctoring evidence" ON public.quiz_proctoring_evidence;
CREATE POLICY "Training staff can read scoped proctoring evidence" ON public.quiz_proctoring_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('trainer', 'training_staff', 'training_coordinator', 'manager', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_proctoring_evidence.quiz_id
        AND q.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.quizzes q
      JOIN public.training_batch_trainers tbt ON tbt.batch_id = q.batch_id
      WHERE q.id = quiz_proctoring_evidence.quiz_id
        AND tbt.trainer_id = auth.uid()
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('quiz-proctoring-evidence', 'quiz-proctoring-evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Training staff can read quiz proctoring storage" ON storage.objects;
CREATE POLICY "Training staff can read quiz proctoring storage" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'quiz-proctoring-evidence'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('trainer', 'training_staff', 'training_coordinator', 'manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can upload own quiz proctoring storage" ON storage.objects;
CREATE POLICY "Authenticated users can upload own quiz proctoring storage" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'quiz-proctoring-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

COMMENT ON COLUMN public.quizzes.proctoring_required IS 'When true, quiz submissions require a validated proctoring session.';
COMMENT ON TABLE public.proctoring_sessions IS 'Per-attempt proctoring readiness and lifecycle state.';
COMMENT ON TABLE public.quiz_proctoring_events IS 'Normalized server-persisted proctoring violations.';
COMMENT ON TABLE public.quiz_proctoring_evidence IS 'Protected evidence references for proctoring events.';

-- Legacy cleanup: old client submissions stored raw data URLs in quiz_attempts.proctoring_events.
-- Keep event metadata visible but remove inline camera frames from employee-readable rows.
UPDATE public.quiz_attempts
SET proctoring_events = COALESCE((
  SELECT jsonb_agg(event_item - 'evidenceImage')
  FROM jsonb_array_elements(proctoring_events) AS event_item
), '[]'::jsonb)
WHERE jsonb_typeof(proctoring_events) = 'array'
  AND proctoring_events::text LIKE '%evidenceImage%';
