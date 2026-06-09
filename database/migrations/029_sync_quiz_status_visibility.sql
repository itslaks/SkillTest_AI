-- ============================================================
-- 029_sync_quiz_status_visibility.sql
-- Makes quizzes.status the source of truth for learner visibility.
-- Safe to re-run.
-- ============================================================

ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active';

UPDATE public.quizzes
SET status = CASE
  WHEN status IN ('draft', 'active', 'archived') THEN status
  WHEN is_active THEN 'active'
  ELSE 'draft'
END;

UPDATE public.quizzes
SET is_active = (status = 'active')
WHERE is_active IS DISTINCT FROM (status = 'active');

ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_status_check;

ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_status_check
  CHECK (status IN ('draft', 'active', 'archived'));

SELECT 'Migration 029 complete: quiz status and is_active are synchronized.' AS status;
