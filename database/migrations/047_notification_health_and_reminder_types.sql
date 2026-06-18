-- Stabilization pass for notification health, reminder coverage, and diagnostics.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.training_automation_runs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%run_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.training_automation_runs DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.training_automation_runs
ADD CONSTRAINT training_automation_runs_run_type_check
CHECK (run_type IN (
  'attendance_cutoff',
  'absence_streak',
  'assessment_reminder',
  'feedback_reminder',
  'quiz_reminder',
  'ai_command_reminder'
));

CREATE INDEX IF NOT EXISTS idx_training_automation_runs_type_time
ON public.training_automation_runs(run_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_notifications_category_status
ON public.training_notifications((metadata->>'category'), delivery_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_notification_dispatch_status_time
ON public.training_notification_dispatch_log(provider_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_assignments_due_date
ON public.quiz_assignments(due_date)
WHERE due_date IS NOT NULL;
