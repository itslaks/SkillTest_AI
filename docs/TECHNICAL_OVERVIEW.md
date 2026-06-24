# SkillTest_AI Technical Overview

SkillTest_AI: Mavericks Execution Platform is a Next.js training management and AI assessment system for admins, managers, training coordinators, trainers, and employees.

## Product Capabilities

| Area | Current Capability |
| --- | --- |
| Authentication | Supabase Auth with employee/trainer signup, trainer approval, and role redirects |
| Profiles | Searchable profile dashboards with employee ID, domain, quiz history, badges, certificates, attendance, uploaded photos, and 15 Three.js 3D avatar presets |
| Domains | Employee signup and assignment workflows use domain/vertical values such as Data Engineering, Java, C Sharp, Dotnet, Mainframe, Python, Cloud, DevOps, Testing, BA, UI/UX, and General |
| Quizzes | Create, import, generate, publish/draft, assign, attempt, score, and analyze quizzes |
| AI Proctoring | Optional per-quiz camera/microphone/fullscreen pre-checks, browser vision signals, live warning UI, private evidence, suspicious attempt gating, and staff integrity review |
| Assignment | Domain/vertical search and color-coded filters for large employee groups |
| Certificates | Quiz create/edit certificate controls, admin-configured defaults, uploaded certificate format images, personalized certificate/course names, review-gated issuing, and old-attempt backfill |
| Badges | Practical milestone catalog with quality, speed, streak, consistency, readiness, and domain award criteria |
| Email | SMTP via Nodemailer first, Resend fallback, console fallback in development |
| AI | OpenAI primary, Groq fallback, Gemini fallback, plus local deterministic stats where possible |
| Chatbot | Manager/admin command chatbot answers true computed stats first, creates structured quizzes from natural-language commands, then AI summarizes only provided DB context with professional admin-facing wording |
| Training Ops | Simplified batch setup, trainers, sessions, attendance, assessment uploads, feedback, reports, and governance controls |
| Exports | Excel/PDF reports for employees, leaderboards, attendance, assessments, feedback, toppers, BRD evidence, and training ops |

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 App Router |
| UI | React 19, TypeScript, Tailwind CSS 4, Radix/shadcn-style components |
| Database/Auth | Supabase PostgreSQL and Supabase Auth |
| AI Providers | OpenAI, Groq OpenAI-compatible API, Google Gemini |
| Email | Nodemailer SMTP, Resend |
| Documents | SheetJS `xlsx`, `jspdf`, `jspdf-autotable` |
| Charts | Recharts |
| Tests | ESLint, Next production build, Playwright smoke test |
| Deployment | Vercel |

## Folder Map

| Path | Purpose |
| --- | --- |
| `app/` | App Router pages, layouts, and API handlers |
| `app/auth/` | Login, signup, password reset, callback, approval screens |
| `app/employee/` | Learner dashboard, quizzes, badges, leaderboard, training |
| `app/manager/` | Manager/admin/trainer operations, quizzes, reports, settings |
| `app/profiles/` | Search and dashboard pages for all visible profiles |
| `app/profile/settings/` | Self-service profile and avatar settings |
| `app/certificates/[id]/` | Professional certificate view and print/download page |
| `app/api/manager-chatbot/` | DB-aware command chatbot endpoint |
| `app/api/proctoring/events/` | Employee proctoring event endpoint with active-session and attempt ownership validation |
| `components/manager/` | Manager workspace UI, assignment manager, command chatbot |
| `app/manager/integrity/` | Staff integrity center for flagged proctored attempts, timelines, evidence previews, and review actions |
| `lib/proctoring-vision.ts` | Browser-only TensorFlow model orchestration for face, gaze, and object detection |
| `components/profile/` | Profile search UI |
| `components/certificates/` | Certificate print/download controls |
| `lib/actions/` | Server actions for auth, employee, manager, quiz, profile, training |
| `lib/ai.ts` | OpenAI/Groq/Gemini provider selection |
| `lib/email.ts` | SMTP/Resend mail sending and templates |
| `lib/insights.ts` | Readiness, retention, behavioral analysis, trainer impact |
| `lib/proctoring.ts` | Proctoring risk scoring and auto-submit thresholds |
| `lib/proctoring-server.ts` | Server-side proctoring session, event, summary, and evidence persistence helpers |
| `lib/domain-options.ts` | Shared domain/vertical list |
| `lib/avatar-options.ts` | 15 built-in Three.js 3D avatar preset IDs |
| `components/avatar/` | Three.js avatar renderer, preset picker, and avatar view wrapper |
| `database/migrations/` | Supabase SQL migrations 001-050 (run in order) |
| `database/seeds/` | Seed data and fixture generators |
| `database/fixes/` | One-off SQL patches (already applied) |

## Important Routes

| URL | Purpose |
| --- | --- |
| `/auth/sign-up` | Employee/trainer signup with work email, employee ID, domain, department |
| `/manager/admin` | Admin console: trainer approval, roles, governance, certificate automation |
| `/manager/employees` | Employee import/export/edit/delete and assignment workflow |
| `/manager/quizzes` | Quiz list, publish/draft control, assignment |
| `/manager/integrity` | Staff proctoring dashboard for flagged attempts and evidence review |
| `/profiles` | Search users by name, email, employee ID, domain, department, role |
| `/profiles/[id]` | Profile dashboard with score, attendance, badge, certificate data |
| `/profile/settings` | Avatar upload/default avatar, display name, domain, department |
| `/certificates/[id]` | Personalized certificate view with uploaded template and print/download |
| `/api/manager-chatbot` | Short, factual manager/admin chatbot responses and structured natural-language quiz creation |
| `/api/proctoring/events` | Authenticated proctoring violation logging for active employee attempts |

## Chatbot Behavior

The command chatbot is intentionally conservative:

- It computes direct stats first for questions such as employee score, quiz average score, weak areas, and certificate eligibility.
- It uses `analyzeAttemptPattern()` for behavioral analysis when an employee+quiz attempt is found.
- It uses AI only after deterministic handlers cannot answer the question.
- It parses quiz-creation commands before generic chat, so prompts like `Create quiz on LLM, difficulty medium and assign it to Ram` produce a structured quiz title, topic, difficulty, generated questions, and assignment when the employee matches.
- Admin quiz creation requires complete command details before a mutation preview is created: topic, assignees/team, difficulty, question count, passing score, time limit, certificate threshold or disabled certificate decision, and AI proctoring enabled/disabled. Missing details return a clarification prompt; completed commands still require Confirm before execution.
- The full AI Command console includes a numbered Quiz Launchpad that constructs validated create/assign commands from structured controls. The floating AI Command preserves pending-action previews and exposes Confirm/Cancel, so chat-initiated assignments can complete.
- AI prompts are instructed to use only supplied database context and keep responses under 60 words.
- If exact data is not loaded or not found, it says so instead of inventing.
- The UI hides internal scope, answer-mode, fallback, and provider labels so managers see polished admin insights only.

Examples it should handle:

| User Question | Expected Behavior |
| --- | --- |
| `ashtoush airflow score and analysis` | Finds matching employee and quiz, returns score, correct count, avg answer time, focus/confidence/risk |
| `average score of rag quiz` | Returns computed average from completed attempts |
| `certificate eligible employees` | Shows missing eligible certificates from enabled rules and completed attempts |
| `weakest topic` | Returns lowest average topic from loaded attempts |
| `Create quiz on LLM, difficulty medium and assign it to Ram` | Asks for missing passing score, time limit, certificate, proctoring, and question-count details before preview |
| `Generate 15 hard SQL questions for the Data Engineering team passing_score=70 time_limit_minutes=30 certificate_min_score=70 proctoring_required=true` | Creates a confirmation preview for a structured `SQL Assessment`; execution happens only after Confirm |

## AI Proctoring Architecture

```text
admin quiz toggle -> quizzes.proctoring_required
employee pre-check -> startQuizAttempt() -> proctoring_sessions
browser integrity signal -> /api/proctoring/events -> quiz_proctoring_events
camera frame -> private storage bucket -> quiz_proctoring_evidence
high-risk/auto-submit -> quiz_attempts.status = suspicious
suspicious attempt -> /manager/integrity -> staff review decision
approved attempt -> status = completed -> score/certificate/badge/email release
```

Proctoring is off by default. Managers/admins enable it per quiz. Employee quiz payloads do not include correct-answer flags before submission, and employee result routes do not expose evidence paths, signed URLs, or blobs. Suspicious attempts show an under-review result state until staff approve or resolve the case.

Staff evidence previews use short-lived signed URLs from the private `quiz-proctoring-evidence` bucket. Employees can read their own proctoring sessions but cannot read normalized evidence rows.

## Certificate System

| Piece | Behavior |
| --- | --- |
| Migration `030` | Creates `certificate_rules`, `certificates`, trigger, badge style columns, and badge seed data |
| Migration `031` | Adds template/personalization columns and backfills old eligible attempts |
| Quiz create/edit | `/manager/quizzes/new` and `/manager/quizzes/[id]/edit` let managers enable certificates, set thresholds, title/name/message/color/notes, and upload a template image |
| Admin settings | `/manager/admin` remains available for administrative certificate rule maintenance |
| Auto issue | Completed and staff-approved attempts create/update certificates when score meets enabled rule |
| Review gate | Suspicious attempts do not expose score, completion status, badges, certificates, or completion emails until approved in `/manager/integrity` |
| Backfill | Run `031` after saving rules to issue missing certificates for old attempts |
| Certificate page | `/certificates/[id]` renders uploaded background with employee/course/score/date details |

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side admin access |
| `NEXT_PUBLIC_APP_URL` | Production | Stable base app URL for auth and email links |
| `ADMIN_ALERT_EMAIL` | Production | Recipient for flag, proctoring, and security alert emails |
| `OPENAI_API_KEY` | Optional | Primary AI provider |
| `GROQ_API_KEY` | Optional | Fast fallback AI provider |
| `GROQ_MODEL` | Optional | Defaults to `llama-3.3-70b-versatile` |
| `GOOGLE_GEMINI_API_KEY` | Optional | Gemini fallback |
| `SMTP_HOST` | Optional | SMTP host, e.g. `smtp.gmail.com` |
| `SMTP_PORT` | Optional | Usually `587` |
| `SMTP_USER` | Optional | SMTP username/email |
| `SMTP_PASS` | Optional | SMTP app password |
| `SMTP_SECURE` | Optional | `false` for port 587, `true` for 465 |
| `RESEND_API_KEY` | Optional | Resend fallback |
| `EMAIL_FROM` | Optional | Sender identity |
| `CRON_SECRET` | Production | Protect governance cron |

## Migration Order

Run SQL scripts in `scripts/` in numeric order. Current latest migration is:

| Migration | Purpose |
| --- | --- |
| `029_sync_quiz_status_visibility.sql` | Aligns quiz `status` and `is_active` visibility |
| `030_certificates_badge_expansion.sql` | Adds certificates, trigger, badge metadata, 260 badges |
| `031_backfill_old_certificates.sql` | Adds certificate template columns and backfills old eligible certificates |
| `032_harden_badge_awards.sql` | Tightens badge award rules so a single quiz completion does not unlock too many badges |
| `033_harden_quiz_certificate_rls.sql` | Scopes direct reads of quiz attempts and certificates to learners and authorized training staff |
| `034_reset_meaningful_badges.sql` | Clears earned badge awards and replaces the old catalog with a smaller useful milestone set |
| `035_repair_training_ops_current_schema.sql` | Reasserts current Training Ops schema compatibility for sessions, attendance, notifications, feedback, assessments, and project edits |
| `036_add_quiz_proctoring.sql` | Adds attempt-level proctoring status, violation count, event summary, and auto-submit fields |
| `037_add_proctoring_risk_engine.sql` | Adds weighted proctoring risk score, risk level, and integrity report fields |
| `038_add_normalized_quiz_proctoring.sql` | Adds optional per-quiz proctoring flag, normalized sessions/events/evidence tables, private evidence bucket, RLS policies, and legacy inline-evidence cleanup |
| `039_proctoring_notifications_realtime.sql` | Adds notification metadata compatibility, realtime publication safety, and unread notification indexing |
| `040_suspicious_attempt_review_gate.sql` | Adds suspicious attempt/proctoring states and review indexes for score and certificate gating |
| `041_trainer_employee_assignments.sql` | Adds trainer-to-employee assignment support |
| `042_proctoring_baseline_and_event_metadata.sql` | Adds baseline face and event metadata fields for richer integrity review |
| `043_migrate_memoji_avatar_presets.sql` through `045_set_all_employee_avatars_to_avatar_01.sql` | Migrates avatar presets and normalizes employee avatar defaults |
| `046_ai_command_operations_copilot.sql` | Adds AI command operations copilot persistence |
| `047_notification_health_and_reminder_types.sql` | Adds notification health and reminder classification fields |
| `048_feedback_admin_review_workflow.sql` | Adds feedback review workflow support |
| `049_saas_tenant_billing_sso_foundation.sql` | Adds organizations, memberships, domains, org settings, billing subscriptions, SSO connections, and nullable organization links |
| `050_proctoring_validation_program.sql` | Adds real-device proctoring validation study/run tables with false-positive and false-negative tracking |

If `030` is already executed, continue with every later migration in numeric order through `050`. It is safe to run `031` again because it uses conflict update, and the proctoring migrations are designed to be rerunnable for staging validation.

## Verification

Recommended checks:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm test
npm run build
npm run test:smoke
```

On this Windows workspace, direct Node paths may be needed if `npm` is not on PATH:

```powershell
& 'C:\Program Files\nodejs\node.exe' .\node_modules\eslint\bin\eslint.js .
& 'C:\Program Files\nodejs\node.exe' .\node_modules\typescript\bin\tsc --noEmit
& 'C:\Program Files\nodejs\node.exe' .\node_modules\next\dist\bin\next build --webpack
$env:PATH='C:\Program Files\nodejs;'+$env:PATH; node database\seeds\browser-smoke.js
```

`npm test` runs lint, TypeScript, and fast unit tests. `npm run test:smoke` is the browser smoke test; it auto-starts `next dev` unless `SMOKE_BASE_URL` points at an already-running environment. Local auto-start requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`. Use `npm run test:all` when the smoke-test environment is configured.
