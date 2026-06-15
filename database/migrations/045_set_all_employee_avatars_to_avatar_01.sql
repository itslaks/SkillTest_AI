-- One-time operational reset requested on 2026-06-15:
-- set every existing employee profile to avatar 1.
--
-- This intentionally overwrites employee avatar choices. Staff/admin/trainer
-- avatars are left untouched.

UPDATE profiles
SET
  avatar_url = 'avatar3d:avatar-01',
  updated_at = NOW()
WHERE role = 'employee';
