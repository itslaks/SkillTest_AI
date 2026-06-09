-- Priority hardening for TMS contest readiness.
-- Adds upload chunk metadata, late attendance evidence, member status audit support,
-- and storage bucket/policies for real assessment and project evidence files.

ALTER TABLE public.training_attendance_uploads
ADD COLUMN IF NOT EXISTS uploaded_after_cutoff BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS chunk_index INTEGER,
ADD COLUMN IF NOT EXISTS chunk_total INTEGER;

ALTER TABLE public.training_assessment_uploads
ADD COLUMN IF NOT EXISTS chunk_index INTEGER,
ADD COLUMN IF NOT EXISTS chunk_total INTEGER;

CREATE INDEX IF NOT EXISTS idx_training_attendance_uploads_late
ON public.training_attendance_uploads(batch_id, uploaded_after_cutoff);

INSERT INTO storage.buckets (id, name, public)
VALUES ('training-evidence', 'training-evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "TMS staff can upload training evidence" ON storage.objects;
CREATE POLICY "TMS staff can upload training evidence" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'training-evidence'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('trainer', 'training_coordinator', 'manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "TMS staff can read scoped training evidence" ON storage.objects;
CREATE POLICY "TMS staff can read scoped training evidence" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'training-evidence'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('trainer', 'training_coordinator', 'manager', 'admin')
    )
  );
