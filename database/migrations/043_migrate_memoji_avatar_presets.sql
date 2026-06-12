-- Normalize employee avatar presets after moving to the static 3D Memoji library.
-- Custom http(s), data URL, and uploaded image values are preserved.

UPDATE profiles
SET
  avatar_url = 'avatar3d:m1',
  updated_at = NOW()
WHERE
  avatar_url IS NULL
  OR btrim(avatar_url) = ''
  OR (
    avatar_url LIKE 'avatar3d:%'
    AND avatar_url NOT IN (
      'avatar3d:m1',
      'avatar3d:m2',
      'avatar3d:m3',
      'avatar3d:m4',
      'avatar3d:m5',
      'avatar3d:m6',
      'avatar3d:m7',
      'avatar3d:f1',
      'avatar3d:f2',
      'avatar3d:f3',
      'avatar3d:f4',
      'avatar3d:f5',
      'avatar3d:f6',
      'avatar3d:f7'
    )
  );
