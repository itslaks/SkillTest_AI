-- Proctoring notification realtime compatibility pass.
-- Safe to run after the existing TMS/proctoring migrations.

ALTER TABLE public.training_notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_training_notifications_unread
ON public.training_notifications(recipient_user_id, created_at DESC)
WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_training_notifications_metadata_category
ON public.training_notifications((metadata->>'category'), created_at DESC);

ALTER TABLE public.training_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.quiz_proctoring_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'training_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.training_notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'quiz_proctoring_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_proctoring_events;
  END IF;
END $$;
