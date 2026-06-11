-- Store baseline identity metadata and structured violation evidence.
-- Run after 041_trainer_employee_assignments.sql.

ALTER TABLE public.proctoring_sessions
  ADD COLUMN IF NOT EXISTS baseline_face_signature JSONB,
  ADD COLUMN IF NOT EXISTS baseline_captured_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS baseline_face_confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS baseline_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.quiz_proctoring_events
  ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS detected_count INTEGER,
  ADD COLUMN IF NOT EXISTS object_label TEXT;

CREATE INDEX IF NOT EXISTS idx_quiz_proctoring_events_object_label
ON public.quiz_proctoring_events(object_label)
WHERE object_label IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_proctoring_events_detected_count
ON public.quiz_proctoring_events(detected_count)
WHERE detected_count IS NOT NULL;

COMMENT ON COLUMN public.proctoring_sessions.baseline_face_signature IS 'Client-generated FaceMesh geometry signature captured after pre-check validation.';
COMMENT ON COLUMN public.proctoring_sessions.baseline_captured_at IS 'Timestamp when the baseline face signature was captured.';
COMMENT ON COLUMN public.proctoring_sessions.baseline_face_confidence IS 'Face detector confidence for the baseline capture.';
COMMENT ON COLUMN public.proctoring_sessions.baseline_metadata IS 'Browser-safe metadata for baseline capture, such as face count, centering, lighting, and signature version.';
COMMENT ON COLUMN public.quiz_proctoring_events.confidence IS 'Detector confidence for this violation event when available.';
COMMENT ON COLUMN public.quiz_proctoring_events.detected_count IS 'Structured count for count-based violations such as multiple faces.';
COMMENT ON COLUMN public.quiz_proctoring_events.object_label IS 'Detected prohibited object label for gadget and object violations.';
