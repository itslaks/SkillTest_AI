-- Avatars are OPTIONAL and have NO default.
--
-- The retired flat 2D preset ids (avatar3d:m1–m7 / f1–f7) were force-assigned
-- to every account by the old system (migration 043 + the old signup default),
-- so stored values were never a deliberate user choice. Clear them all to
-- NULL: every user starts avatar-less (the UI shows a neutral placeholder)
-- and picks their own 3D avatar from profile settings if they want one.
--
-- Deliberately chosen values are preserved:
--   * new 3D preset ids (avatar3d:avatar-01 .. avatar-40)
--   * custom http(s) photo URLs and data-URL uploads
--
-- lib/avatar-options.ts applies the same rule at render time, so un-migrated
-- rows display correctly even before this migration runs.

UPDATE profiles
SET avatar_url = NULL, updated_at = NOW()
WHERE
  (
    avatar_url LIKE 'avatar3d:%'
    -- Anything that is not one of the new avatar-01..avatar-40 ids
    AND avatar_url !~ '^avatar3d:avatar-(0[1-9]|[1-3][0-9]|40)$'
  )
  OR (avatar_url IS NOT NULL AND btrim(avatar_url) = '');
