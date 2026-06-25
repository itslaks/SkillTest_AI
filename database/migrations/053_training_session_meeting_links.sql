-- Adds practical session join-link support for trainer/employee session allocation.

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS meeting_url TEXT;

CREATE INDEX IF NOT EXISTS idx_training_sessions_meeting_url
ON public.training_sessions(id)
WHERE meeting_url IS NOT NULL AND meeting_url <> '';
