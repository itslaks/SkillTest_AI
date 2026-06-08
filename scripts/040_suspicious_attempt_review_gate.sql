-- Suspicious attempt review gate.
-- Expands attempt/proctoring statuses so high-risk proctored submissions can be
-- held for staff review before scores, certificates, badges, and completion emails release.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.quiz_attempts'::regclass
    AND contype = 'c'
    AND conkey = ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.quiz_attempts'::regclass AND attname = 'status')
    ]::smallint[];

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.quiz_attempts DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.quiz_attempts
  ADD CONSTRAINT quiz_attempts_status_check
  CHECK (status IN ('in_progress', 'completed', 'abandoned', 'suspicious'));

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.quiz_attempts'::regclass
    AND contype = 'c'
    AND conkey = ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.quiz_attempts'::regclass AND attname = 'proctoring_status')
    ]::smallint[];

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.quiz_attempts DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.quiz_attempts
  ADD CONSTRAINT quiz_attempts_proctoring_status_check
  CHECK (proctoring_status IS NULL OR proctoring_status IN ('clear', 'flagged', 'suspicious'));

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_suspicious_review
ON public.quiz_attempts(review_status, proctoring_risk_score DESC, completed_at DESC)
WHERE status = 'suspicious';

COMMENT ON COLUMN public.quiz_attempts.review_status IS 'Suspicious proctoring attempts remain pending until staff approve, reject, dismiss, or require retest.';
