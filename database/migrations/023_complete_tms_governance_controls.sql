-- Completion pass for BRD-visible governance controls:
-- configurable cutoff/topper settings, attendance upload logs, feedback windows, and notification audit clarity.

CREATE TABLE IF NOT EXISTS public.training_system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.training_system_settings(key, value)
VALUES
  ('attendance_cutoff_time', '"10:00"'),
  ('absence_alert_days', '3'),
  ('topper_assessment_weight', '70'),
  ('topper_project_weight', '30'),
  ('topper_min_attendance', '75'),
  ('feedback_window_days', '5')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.training_attendance_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.training_batches(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT,
  total_records INTEGER NOT NULL DEFAULT 0,
  successful_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,
  error_log JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_attendance_uploads_session_id
ON public.training_attendance_uploads(session_id);

CREATE TABLE IF NOT EXISTS public.training_feedback_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.training_batches(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.training_sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  opens_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closes_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_feedback_windows_batch_id
ON public.training_feedback_windows(batch_id);

CREATE TABLE IF NOT EXISTS public.training_notification_dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.training_notifications(id) ON DELETE CASCADE,
  recipient_email TEXT,
  channel TEXT NOT NULL DEFAULT 'email',
  provider_status TEXT NOT NULL DEFAULT 'logged',
  provider_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_notification_dispatch_log_notification_id
ON public.training_notification_dispatch_log(notification_id);
