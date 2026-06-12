# SkillTest_AI 3D Memoji Avatar Presets

Static preset assets for employee profile avatars.

- Source style: 3D Memoji-inspired enterprise avatar set.
- Format: WebP.
- Master size: 4096 x 4096 px.
- App storage value: `avatar3d:<id>`, for example `avatar3d:m1`.
- Runtime path: `/avatars/memoji/<id>.webp`.

The app stores the preset identifier in `profiles.avatar_url` and resolves it to this static asset path at render time. Custom uploaded image URLs are still supported.
