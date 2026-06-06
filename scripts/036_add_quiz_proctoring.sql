-- Add durable quiz proctoring evidence and flags.
-- Run after 035_repair_training_ops_current_schema.sql.

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS proctoring_status TEXT DEFAULT NULL
    CHECK (proctoring_status IS NULL OR proctoring_status IN ('clear', 'flagged')),
  ADD COLUMN IF NOT EXISTS proctoring_violations_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proctoring_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_submitted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_proctoring_status
ON public.quiz_attempts(proctoring_status)
WHERE proctoring_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_auto_submitted
ON public.quiz_attempts(auto_submitted)
WHERE auto_submitted = TRUE;

COMMENT ON COLUMN public.quiz_attempts.proctoring_status IS 'Client proctoring result for the quiz attempt: clear or flagged.';
COMMENT ON COLUMN public.quiz_attempts.proctoring_violations_count IS 'Number of detected proctoring violations submitted with the attempt.';
COMMENT ON COLUMN public.quiz_attempts.proctoring_events IS 'JSON evidence events captured by camera/focus/fullscreen proctoring.';
COMMENT ON COLUMN public.quiz_attempts.auto_submitted IS 'True when the quiz was submitted automatically after violation limit or timer expiry.';
