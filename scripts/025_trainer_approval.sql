-- ============================================================
-- 025_trainer_approval.sql
-- Adds approval_status column to profiles for trainer sign-up workflow
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add approval_status column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- 2. Add rejection_reason column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

-- 3. Index for admin dashboard query performance
CREATE INDEX IF NOT EXISTS idx_profiles_role_approval
  ON profiles (role, approval_status);

-- 4. Backfill: all existing trainers = approved (they were created before this system)
UPDATE profiles
  SET approval_status = 'approved'
  WHERE role = 'trainer' AND approval_status IS DISTINCT FROM 'approved';

-- 5. Ensure admin account has correct role and approval status
UPDATE profiles
  SET role = 'admin', approval_status = 'approved'
  WHERE email = 'admin@hexaware.com';

-- 6. Grant admin sample trainer (trainer@hexaware.com) approved status
UPDATE profiles
  SET approval_status = 'approved'
  WHERE email = 'trainer@hexaware.com' AND role = 'trainer';

-- Done
SELECT 'Migration 025 complete' AS status;
