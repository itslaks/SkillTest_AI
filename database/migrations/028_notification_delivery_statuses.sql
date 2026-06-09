-- Expands notification audit states so records can distinguish queued, sent, failed, and logged delivery.

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.training_notifications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%delivery_status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.training_notifications DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.training_notifications
ADD CONSTRAINT training_notifications_delivery_status_check
CHECK (delivery_status IN ('draft', 'scheduled', 'queued', 'sent', 'failed', 'logged'));

CREATE INDEX IF NOT EXISTS idx_training_notifications_delivery_status
ON public.training_notifications(delivery_status, created_at DESC);
