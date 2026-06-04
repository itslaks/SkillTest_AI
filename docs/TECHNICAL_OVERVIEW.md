# SkillTest_AI Technical Overview

SkillTest_AI: Mavericks Execution Platform is a Next.js training management and AI assessment system for admins, managers, training coordinators, trainers, and employees.

## Product Capabilities

| Area | Current Capability |
| --- | --- |
| Authentication | Supabase Auth with employee/trainer signup, trainer approval, and role redirects |
| Profiles | Searchable profile dashboards with employee ID, domain, quiz history, badges, certificates, attendance, avatar support, and a direct dashboard return action |
| Domains | Employee signup and assignment workflows use domain/vertical values such as Data Engineering, Java, C Sharp, Dotnet, Mainframe, Python, Cloud, DevOps, Testing, BA, UI/UX, and General |
| Quizzes | Create, import, generate, publish/draft, assign, attempt, score, and analyze quizzes |
| Assignment | Domain/vertical search and color-coded filters for large employee groups |
| Certificates | Admin-configured thresholds, uploaded certificate format images, personalized certificate/course names, auto-issue triggers, and old-attempt backfill |
| Badges | Practical milestone catalog with quality, speed, streak, consistency, readiness, and domain award criteria |
| Email | SMTP via Nodemailer first, Resend fallback, console fallback in development |
| AI | OpenAI primary, Groq fallback, Gemini fallback, plus local deterministic stats where possible |
| Chatbot | Manager/admin command chatbot answers true computed stats first, then AI summarizes only provided DB context with professional admin-facing wording |
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
| `components/manager/` | Manager workspace UI, assignment manager, command chatbot |
| `components/profile/` | Profile search UI |
| `components/certificates/` | Certificate print/download controls |
| `lib/actions/` | Server actions for auth, employee, manager, quiz, profile, training |
| `lib/ai.ts` | OpenAI/Groq/Gemini provider selection |
| `lib/email.ts` | SMTP/Resend mail sending and templates |
| `lib/insights.ts` | Readiness, retention, behavioral analysis, trainer impact |
| `lib/domain-options.ts` | Shared domain/vertical list |
| `lib/avatar-options.ts` | 15 built-in default avatar faces |
| `scripts/` | Supabase migrations, seed scripts, fixtures, smoke test |

## Important Routes

| URL | Purpose |
| --- | --- |
| `/auth/sign-up` | Employee/trainer signup with work email, employee ID, domain, department |
| `/manager/admin` | Admin console: trainer approval, roles, governance, certificate automation |
| `/manager/employees` | Employee import/export/edit/delete and assignment workflow |
| `/manager/quizzes` | Quiz list, publish/draft control, assignment |
| `/profiles` | Search users by name, email, employee ID, domain, department, role |
| `/profiles/[id]` | Profile dashboard with score, attendance, badge, certificate data |
| `/profile/settings` | Avatar upload/default avatar, display name, domain, department |
| `/certificates/[id]` | Personalized certificate view with uploaded template and print/download |
| `/api/manager-chatbot` | Short, factual manager/admin chatbot responses without exposing internal provider/fallback labels in the UI |

## Chatbot Behavior

The command chatbot is intentionally conservative:

- It computes direct stats first for questions such as employee score, quiz average score, weak areas, and certificate eligibility.
- It uses `analyzeAttemptPattern()` for behavioral analysis when an employee+quiz attempt is found.
- It uses AI only after deterministic handlers cannot answer the question.
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

## Certificate System

| Piece | Behavior |
| --- | --- |
| Migration `030` | Creates `certificate_rules`, `certificates`, trigger, badge style columns, and badge seed data |
| Migration `031` | Adds template/personalization columns and backfills old eligible attempts |
| Admin settings | `/manager/admin` lets admins enable certificates, set any threshold such as 90%, set title/name/message/color, and upload a template image |
| Auto issue | New completed attempts create/update certificates when score meets enabled rule |
| Backfill | Run `031` after saving rules to issue missing certificates for old attempts |
| Certificate page | `/certificates/[id]` renders uploaded background with employee/course/score/date details |

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side admin access |
| `NEXT_PUBLIC_APP_URL` | Recommended | Base app URL |
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

If `030` is already executed, run `031` after saving certificate rules in `/manager/admin`, then run `032` to harden badge awards, `033` to harden quiz-attempt and certificate RLS, and `034` to reset badges from scratch. It is safe to run `031` again because it uses conflict update.

## Verification

Recommended checks:

```bash
npm run lint
npm run build
npm run test:smoke
```

On this Windows workspace, direct Node paths may be needed if `npm` is not on PATH:

```powershell
& 'C:\Program Files\nodejs\node.exe' .\node_modules\eslint\bin\eslint.js .
& 'C:\Program Files\nodejs\node.exe' .\node_modules\next\dist\bin\next build --webpack
$env:PATH='C:\Program Files\nodejs;'+$env:PATH; node scripts\browser-smoke.js
```
