-- Adds admin review state for collected learner feedback.

ALTER TABLE public.training_feedback
ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (review_status IN ('pending', 'reviewed', 'dismissed')),
ADD COLUMN IF NOT EXISTS review_notes TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.training_feedback
SET review_status = 'pending'
WHERE review_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_training_feedback_review_status
ON public.training_feedback(review_status);

CREATE INDEX IF NOT EXISTS idx_training_feedback_reviewed_by
ON public.training_feedback(reviewed_by);
