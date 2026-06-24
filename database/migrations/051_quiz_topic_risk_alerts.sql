-- Tracks quiz questions whose wrong-answer rate shows a topic-level training risk.
-- A row is created the first time a question crosses the configured threshold,
-- then updated with current counts on later submissions without re-notifying.

CREATE TABLE IF NOT EXISTS public.quiz_topic_risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  question_text TEXT NOT NULL,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  wrong_attempts INTEGER NOT NULL DEFAULT 0,
  wrong_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  threshold NUMERIC(5,2) NOT NULL DEFAULT 25.00,
  notified_user_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quiz_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_topic_risk_alerts_quiz_id
ON public.quiz_topic_risk_alerts(quiz_id);

CREATE INDEX IF NOT EXISTS idx_quiz_topic_risk_alerts_topic
ON public.quiz_topic_risk_alerts(topic);

ALTER TABLE public.quiz_topic_risk_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Training staff can view quiz topic risk alerts"
ON public.quiz_topic_risk_alerts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('trainer', 'training_coordinator', 'manager', 'admin')
  )
);

CREATE POLICY "Employees can view alerts for assigned quizzes"
ON public.quiz_topic_risk_alerts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.quiz_assignments qa
    WHERE qa.quiz_id = quiz_topic_risk_alerts.quiz_id
      AND qa.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.set_quiz_topic_risk_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_evaluated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_quiz_topic_risk_alerts_updated_at ON public.quiz_topic_risk_alerts;
CREATE TRIGGER set_quiz_topic_risk_alerts_updated_at
BEFORE UPDATE ON public.quiz_topic_risk_alerts
FOR EACH ROW
EXECUTE FUNCTION public.set_quiz_topic_risk_alerts_updated_at();
