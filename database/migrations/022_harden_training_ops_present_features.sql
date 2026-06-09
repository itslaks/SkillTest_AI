-- Hardening pass for the existing Training Operations module.
-- Keeps current data, aligns lifecycle/status language with the BRD, and adds audit-ready status history.

DO $$
BEGIN
  IF to_regclass('public.training_batches') IS NULL THEN
    RAISE EXCEPTION 'Base training operations tables are missing. Run scripts/020_create_training_operations.sql first, then run scripts/022_harden_training_ops_present_features.sql.';
  END IF;

  IF to_regclass('public.batch_members') IS NULL THEN
    RAISE EXCEPTION 'Base batch member table is missing. Run scripts/020_create_training_operations.sql first, then run scripts/022_harden_training_ops_present_features.sql.';
  END IF;
END $$;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('employee', 'trainer', 'training_coordinator', 'manager', 'admin'));

UPDATE public.training_batches
SET status = 'running'
WHERE status IN ('active', 'at_risk');

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.training_batches'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.training_batches DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.training_batches
ADD CONSTRAINT training_batches_status_check
CHECK (status IN ('planned', 'running', 'completed', 'closed'));

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.batch_members'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%enrollment_status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.batch_members DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.batch_members
ADD CONSTRAINT batch_members_enrollment_status_check
CHECK (enrollment_status IN ('invited', 'active', 'completed', 'dropped', 'discontinued', 'not_cleared', 'offered', 'onboarded'));

CREATE TABLE IF NOT EXISTS public.training_batch_status_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.training_batches(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_batch_status_audit_batch_id
ON public.training_batch_status_audit(batch_id);

CREATE OR REPLACE FUNCTION public.log_training_batch_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.training_batch_status_audit(batch_id, previous_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS training_batch_status_audit_trigger ON public.training_batches;
CREATE TRIGGER training_batch_status_audit_trigger
AFTER UPDATE ON public.training_batches
FOR EACH ROW
EXECUTE FUNCTION public.log_training_batch_status_change();
