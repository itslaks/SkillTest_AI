-- Backfill certificates for old completed quiz attempts after migration 030.
-- Run this after admins have enabled certificate rules for the quizzes.

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
  COALESCE(rule.title, 'Certificate of Achievement'),
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
