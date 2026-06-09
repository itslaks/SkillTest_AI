# Database

This folder contains all SQL migration scripts, seed data, and one-off fixes for SkillTest_AI.

## Folder Layout

```
database/
├── migrations/   # Sequential schema migrations — run in order
├── seeds/        # Seed data and test fixture generators
└── fixes/        # One-off SQL patches (already applied to production)
```

## Running Migrations

Open the Supabase SQL Editor and run the files in **`migrations/`** in numeric order (001 → 040).

| Range | What it creates |
|-------|----------------|
| 001–006 | Core tables: profiles, quizzes, questions, attempts, gamification, triggers |
| 007–012 | Badges, passing score, assignments, leaderboard/manager RLS, assessment imports |
| 013–018 | RBAC trigger fix, quiz status, approval system removal, timestamps |
| 019–026 | Meaningful badges, training operations, RLS hardening, governance, TMS controls |
| 027–032 | Attendance late reasons, notification statuses, quiz visibility, certificates, badge awards |
| 033–040 | Proctoring schema, risk engine, normalized events, realtime notifications, suspicious gating |

## Seeds (`seeds/`)

| File | Purpose |
|------|---------|
| `seed_admin.js` | Create default admin and trainer accounts |
| `generate-tms-upload-fixtures.js` | Generate bulk TMS import test data |
| `generate-contest-demo-fixtures.js` | Generate demo contest fixtures |
| `validate-tms-import-scale.js` | Validate import scale for large datasets |
| `browser-smoke.js` | Playwright browser smoke test runner |

## Fixes (`fixes/`)

These SQL files are **already applied** to production and do not need to be re-run unless rebuilding from scratch.

| File | What it does |
|------|-------------|
| `remove_approval_system.sql` | Drops the old approval_requests table |
| `IMMEDIATE_FIX.sql` | Emergency RLS patch applied during early production |
