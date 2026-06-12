-- 043_cleanup_orphan_employee_auth_users.sql
-- Removes historical employee Auth users that no longer have a profile row.
-- These orphans caused future employee invites/signups with the same email to
-- fail with "A user with this email address has already been registered".

DELETE FROM auth.users AS auth_user
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles AS profile
  WHERE profile.id = auth_user.id
)
AND COALESCE(auth_user.raw_user_meta_data ->> 'role', 'employee') = 'employee';

SELECT 'Migration 043 complete: orphan employee auth users removed' AS status;
