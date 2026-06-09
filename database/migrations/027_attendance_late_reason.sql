-- Requires an operator reason whenever attendance is uploaded after the configured cut-off.

ALTER TABLE public.training_attendance_uploads
ADD COLUMN IF NOT EXISTS uploaded_after_cutoff BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS chunk_index INTEGER,
ADD COLUMN IF NOT EXISTS chunk_total INTEGER,
ADD COLUMN IF NOT EXISTS late_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_training_attendance_uploads_late_reason
ON public.training_attendance_uploads(batch_id, uploaded_after_cutoff)
WHERE uploaded_after_cutoff = TRUE;
