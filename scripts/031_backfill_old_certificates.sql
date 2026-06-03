-- 031_backfill_old_certificates.sql
-- Enhances certificate personalization and backfills old completed quiz attempts.
-- Run this after migration 030 and after admins have enabled certificate rules.

ALTER TABLE public.certificate_rules
  ADD COLUMN IF NOT EXISTS certificate_name TEXT DEFAULT 'Course Completion Certificate',
  ADD COLUMN IF NOT EXISTS template_image_url TEXT,
  ADD COLUMN IF NOT EXISTS template_accent_color TEXT DEFAULT '#d97706',
  ADD COLUMN IF NOT EXISTS template_notes TEXT;

COMMENT ON COLUMN public.certificate_rules.min_score IS 'Admin-configured certificate threshold. Examples: 70, 80, 90, 95.';
COMMENT ON COLUMN public.certificate_rules.template_image_url IS 'Optional admin-uploaded certificate format/background. Employee and course details are rendered dynamically by the app.';

INSERT INTO public.certificates (
  rule_id,
  quiz_id,
  user_id,
  attempt_id,
  title,
  message,
  score,
  issued_by
)
SELECT
  rule.id,
  attempt.quiz_id,
  attempt.user_id,
  attempt.id,
  COALESCE(rule.certificate_name, rule.title, 'Course Completion Certificate'),
  COALESCE(rule.message, 'Awarded for meeting the certification score threshold.'),
  attempt.score,
  rule.created_by
FROM public.quiz_attempts attempt
JOIN public.certificate_rules rule
  ON rule.quiz_id = attempt.quiz_id
WHERE attempt.status = 'completed'
  AND rule.enabled = TRUE
  AND attempt.score >= rule.min_score
ON CONFLICT (quiz_id, user_id)
DO UPDATE SET
  rule_id = EXCLUDED.rule_id,
  attempt_id = EXCLUDED.attempt_id,
  title = EXCLUDED.title,
  message = EXCLUDED.message,
  score = EXCLUDED.score;

SELECT 'Migration 031 complete: old qualifying quiz attempts backfilled into certificates.' AS status;
