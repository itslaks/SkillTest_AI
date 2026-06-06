-- Adds weighted assessment integrity scoring on top of stored proctoring events.
-- Run after 036_add_quiz_proctoring.sql.

ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS proctoring_risk_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proctoring_risk_level TEXT DEFAULT NULL
    CHECK (proctoring_risk_level IS NULL OR proctoring_risk_level IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS integrity_report JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_proctoring_risk_score
ON public.quiz_attempts(proctoring_risk_score DESC)
WHERE proctoring_risk_score > 0;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_proctoring_risk_level
ON public.quiz_attempts(proctoring_risk_level)
WHERE proctoring_risk_level IS NOT NULL;

COMMENT ON COLUMN public.quiz_attempts.proctoring_risk_score IS 'Weighted assessment integrity risk score calculated from proctoring events.';
COMMENT ON COLUMN public.quiz_attempts.proctoring_risk_level IS 'Assessment integrity risk tier: low, medium, high, or critical.';
COMMENT ON COLUMN public.quiz_attempts.integrity_report IS 'Generated incident summary with timeline, risk analysis, and evidence metadata.';
