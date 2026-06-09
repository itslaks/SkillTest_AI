-- ============================================================
-- 041_trainer_employee_assignments.sql
-- Adds direct trainer-to-employee ownership for scoped trainer management.
-- Run this in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS trainer_employee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  UNIQUE(trainer_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_employee_assignments_trainer
  ON trainer_employee_assignments(trainer_id);

CREATE INDEX IF NOT EXISTS idx_trainer_employee_assignments_employee
  ON trainer_employee_assignments(employee_id);

ALTER TABLE trainer_employee_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage trainer employee assignments" ON trainer_employee_assignments;
CREATE POLICY "Admins manage trainer employee assignments"
  ON trainer_employee_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Trainers read own employee assignments" ON trainer_employee_assignments;
CREATE POLICY "Trainers read own employee assignments"
  ON trainer_employee_assignments
  FOR SELECT
  USING (trainer_id = auth.uid());

SELECT 'Migration 041 complete' AS status;
