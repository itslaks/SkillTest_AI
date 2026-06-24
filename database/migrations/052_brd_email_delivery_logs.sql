-- BRD mandatory email delivery audit log and dashboard-performance indexes.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'brd_email_status') THEN
    CREATE TYPE public.brd_email_status AS ENUM ('pending', 'sent', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.brd_email_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_role TEXT,
  related_batch_id UUID REFERENCES public.training_batches(id) ON DELETE SET NULL,
  related_notification_id UUID REFERENCES public.training_notifications(id) ON DELETE SET NULL,
  status public.brd_email_status NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'none',
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brd_email_notification_logs_event_status
ON public.brd_email_notification_logs(event_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brd_email_notification_logs_batch
ON public.brd_email_notification_logs(related_batch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brd_email_notification_logs_failed
ON public.brd_email_notification_logs(status, created_at DESC)
WHERE status = 'failed';

ALTER TABLE public.brd_email_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view BRD email logs"
ON public.brd_email_notification_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('training_coordinator', 'manager', 'admin')
  )
);

CREATE OR REPLACE FUNCTION public.set_brd_email_notification_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_brd_email_notification_logs_updated_at ON public.brd_email_notification_logs;
CREATE TRIGGER set_brd_email_notification_logs_updated_at
BEFORE UPDATE ON public.brd_email_notification_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_brd_email_notification_logs_updated_at();

CREATE INDEX IF NOT EXISTS idx_batch_members_status_batch
ON public.batch_members(batch_id, enrollment_status, support_status);

CREATE INDEX IF NOT EXISTS idx_session_attendance_session_status
ON public.session_attendance(session_id, status);

CREATE INDEX IF NOT EXISTS idx_assessment_results_batch_percentage
ON public.assessment_results(batch_id, percentage);

CREATE INDEX IF NOT EXISTS idx_training_sessions_batch_date
ON public.training_sessions(batch_id, session_date DESC);

CREATE INDEX IF NOT EXISTS idx_training_batch_trainers_trainer_batch
ON public.training_batch_trainers(trainer_id, batch_id);
