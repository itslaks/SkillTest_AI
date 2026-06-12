-- Replace the retired flat 2D Memoji preset ids (m1–m7, f1–f7) with their
-- closest match in the new 3D avatar library (public/avatars/3d/avatar-NN.webp).
-- Mapping mirrors LEGACY_AVATAR_3D_MAP in lib/avatar-options.ts, which also
-- resolves any un-migrated value at render time as a safety net.
--
-- Avatars are OPTIONAL: NULL/empty values stay NULL (the UI shows a neutral
-- placeholder), and unknown preset ids are cleared to NULL rather than being
-- force-assigned a default. Custom http(s) and data-URL uploads are untouched.

UPDATE profiles
SET
  avatar_url = CASE avatar_url
    WHEN 'avatar3d:m1' THEN 'avatar3d:avatar-13'
    WHEN 'avatar3d:m2' THEN 'avatar3d:avatar-03'
    WHEN 'avatar3d:m3' THEN 'avatar3d:avatar-02'
    WHEN 'avatar3d:m4' THEN 'avatar3d:avatar-17'
    WHEN 'avatar3d:m5' THEN 'avatar3d:avatar-15'
    WHEN 'avatar3d:m6' THEN 'avatar3d:avatar-01'
    WHEN 'avatar3d:m7' THEN 'avatar3d:avatar-14'
    WHEN 'avatar3d:f1' THEN 'avatar3d:avatar-04'
    WHEN 'avatar3d:f2' THEN 'avatar3d:avatar-05'
    WHEN 'avatar3d:f3' THEN 'avatar3d:avatar-20'
    WHEN 'avatar3d:f4' THEN 'avatar3d:avatar-21'
    WHEN 'avatar3d:f5' THEN 'avatar3d:avatar-25'
    WHEN 'avatar3d:f6' THEN 'avatar3d:avatar-19'
    WHEN 'avatar3d:f7' THEN 'avatar3d:avatar-06'
    ELSE NULL
  END,
  updated_at = NOW()
WHERE
  avatar_url LIKE 'avatar3d:%'
  -- Any preset value that is not one of the new avatar-01..avatar-40 ids
  AND avatar_url !~ '^avatar3d:avatar-(0[1-9]|[1-3][0-9]|40)$';

-- Normalize empty strings to NULL for a consistent "no avatar" state.
UPDATE profiles
SET avatar_url = NULL, updated_at = NOW()
WHERE avatar_url IS NOT NULL AND btrim(avatar_url) = '';
