-- Proctoring validation program: stores real-device validation runs and outcomes.

CREATE TABLE IF NOT EXISTS public.proctoring_validation_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'completed', 'archived')),
  target_devices INTEGER NOT NULL DEFAULT 0 CHECK (target_devices >= 0),
  target_participants INTEGER NOT NULL DEFAULT 0 CHECK (target_participants >= 0),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.proctoring_validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.proctoring_validation_studies(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  participant_label TEXT NOT NULL,
  browser_name TEXT,
  browser_version TEXT,
  device_label TEXT,
  camera_resolution TEXT,
  lighting_condition TEXT CHECK (lighting_condition IN ('bright', 'normal', 'dim', 'backlit', 'mixed') OR lighting_condition IS NULL),
  network_condition TEXT CHECK (network_condition IN ('fast', 'normal', 'slow', 'unstable') OR network_condition IS NULL),
  model_load_ms INTEGER CHECK (model_load_ms IS NULL OR model_load_ms >= 0),
  expected_scenario TEXT NOT NULL,
  expected_violation BOOLEAN NOT NULL DEFAULT FALSE,
  observed_violation BOOLEAN NOT NULL DEFAULT FALSE,
  false_positive BOOLEAN GENERATED ALWAYS AS (observed_violation = TRUE AND expected_violation = FALSE) STORED,
  false_negative BOOLEAN GENERATED ALWAYS AS (observed_violation = FALSE AND expected_violation = TRUE) STORED,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proctoring_validation_studies_org_status
ON public.proctoring_validation_studies(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_proctoring_validation_runs_study
ON public.proctoring_validation_runs(study_id);

CREATE INDEX IF NOT EXISTS idx_proctoring_validation_runs_accuracy
ON public.proctoring_validation_runs(false_positive, false_negative);

ALTER TABLE public.proctoring_validation_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_validation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proctoring_validation_studies_member_select ON public.proctoring_validation_studies;
CREATE POLICY proctoring_validation_studies_member_select ON public.proctoring_validation_studies
FOR SELECT USING (organization_id IS NULL OR public.is_organization_member(organization_id));

DROP POLICY IF EXISTS proctoring_validation_runs_member_select ON public.proctoring_validation_runs;
CREATE POLICY proctoring_validation_runs_member_select ON public.proctoring_validation_runs
FOR SELECT USING (organization_id IS NULL OR public.is_organization_member(organization_id));
