# SkillTest_AI - Mavericks Execution Platform

> AI-powered Training Management System for enterprise learning teams.
> Quizzes - Evidence Packs - Compliance Reporting - Optional AI Proctoring - Certificates - Attendance - in one Next.js app.

---

## Table of Contents

- [What is this?](#what-is-this)
- [Who uses it?](#who-uses-it)
- [Feature Map](#feature-map)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Quick Start](#quick-start)
- [Key Pages](#key-pages)
- [Roles & Permissions](#roles--permissions)
- [Docs](#docs)
- [Changelog](#changelog)

---

## What is this?

SkillTest_AI runs the full lifecycle of employee training and assessment:

```
Onboard employees -> Assign quizzes -> Run proctored tests
-> Auto-score -> Issue certificates -> Generate reports -> Prove compliance
```

It is built for training managers and HR teams who need **training execution evidence**, not just a quiz screen.

---

## Who uses it?

| Role | Color | What they do |
|------|-------|-------------|
| Admin | Red | Full platform control: user governance, approvals, SaaS/billing/SSO setup, all reports |
| Manager | Orange | Create and assign quizzes, manage employees, run analytics, review proctoring |
| Training Coordinator | Yellow | Manage batches, attendance, score uploads, feedback windows, and scoped operations |
| Trainer | Green | Use assigned training tools, create training assessments, run AI commands, review assigned risk, and update assigned learners |
| Employee | Blue | Take quizzes, earn badges, view certificates, track leaderboard |

---

## Feature Map

### Employee Features
| Feature | Description |
|---------|-------------|
| Adaptive Quiz Engine | Questions reorder by difficulty based on live performance signals |
| Optional AI Proctoring | Camera - baseline face identity - multiple-face detection - gadget detection - gaze tracking - browser lock, with staff review for false-positive handling |
| Certificates | Auto-issued on pass; downloadable with custom title, message, and template |
| Badge Universe | 250+ badges across 12 categories earned from quiz performance and streaks |
| Leaderboard | Live and cumulative rankings with points and streaks |
| AI Learner Coach | Personalized recommendations based on quiz history and retention signals |

### Manager Features
| Feature | Description |
|---------|-------------|
| AI Quiz Generation | Generate MCQs from a topic, uploaded file, or natural-language command |
| Integrity Center | Review flagged attempts with evidence thumbnails, approve/reject/retest |
| AI Insights | Batch health, trainer performance, and quiz outcome coaching |
| Assessment Analyzer | Upload score sheets and chat with AI about weak areas |
| Command Chatbot | "Create quiz on Python, assign to Ram" -> quiz created |
| Import Workflows | Employees, quiz questions, attendance, scores - CSV/TXT/XLSX/DOCX/PDF/XML/JSON |
| Reports | Excel + PDF exports for attendance, assessment, feedback, toppers |
| Compliance Evidence Pack | Downloadable workbook that packages attendance, assessment, feedback, notification, audit, and BRD coverage evidence |

### Training Operations
| Feature | Description |
|---------|-------------|
| Batch Management | Create batches, assign trainers and learners, link assessments |
| Attendance | Cutoff enforcement, late reasons, version history, bulk import |
| Project Evaluations | Trainer-submitted evaluation forms per batch |
| Email Automation | Assignment, completion, and proctoring alert emails via SMTP or Resend |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 App Router |
| Language | TypeScript + TSX |
| UI | React 19 - Tailwind CSS 4 - shadcn/Radix |
| Auth | Supabase Auth |
| Database | Supabase PostgreSQL + Row-Level Security |
| AI | OpenAI -> Groq -> Gemini (waterfall fallback) |
| Vision | TensorFlow.js (face - gaze - object detection) |
| Email | Nodemailer (SMTP) or Resend API |
| Excel | SheetJS `xlsx` |
| PDF | `jspdf` + `jspdf-autotable` |
| Charts | Recharts |
| Deployment | Vercel |

---

## Project Structure

```
SkillTest_AI/
|
+-- app/                      FRONTEND - Next.js pages + API routes
|   +-- api/                   <- REST endpoints (AI, proctoring, exports, imports)
|   +-- auth/                  <- Login, sign-up, reset password
|   +-- employee/              <- Employee workspace (quizzes, badges, training)
|   +-- manager/               <- Manager workspace (quizzes, analytics, integrity)
|   +-- certificates/          <- Public certificate viewer
|
+-- components/               FRONTEND - Reusable React components
|   +-- ui/                    <- Base shadcn/Radix components (50+)
|   +-- manager/               <- Manager-specific widgets
|   +-- employee/              <- Employee-specific widgets
|   +-- avatar/ - landing/ - quiz/ - certificates/ - ...
|
+-- lib/                      BACKEND - Business logic & utilities
|   +-- actions/               <- Next.js server actions (form handlers)
|   +-- backend/               <- Controllers -> Services -> Repositories
|   |   +-- controllers/       <- Route orchestration
|   |   +-- services/          <- Business rules
|   |   +-- repositories/      <- Database queries
|   +-- security/              <- Zod validation, rate limiting
|   +-- supabase/              <- DB client helpers
|   +-- proctoring.ts          <- Risk weights & thresholds
|   +-- proctoring-server.ts   <- Server-side session & evidence
|   +-- proctoring-vision.ts   <- Browser TensorFlow detection
|   +-- email.ts               <- Email builder (SMTP / Resend)
|   +-- rbac.ts                <- Role access control
|
+-- database/                 DATABASE - All SQL and seed files
|   +-- migrations/            <- 001-050 sequential schema migrations
|   +-- seeds/                 <- Seed data and fixture generators
|   +-- fixes/                 <- One-off patches (already applied)
|
+-- docs/                     DOCUMENTATION
|   +-- ARCHITECTURE.md        <- Full architecture with flow diagrams
|   +-- SETUP.md               <- Step-by-step local setup
|   +-- TECHNICAL_OVERVIEW.md  <- Technical reference
|   +-- PROCTORING.md          <- AI proctoring deep-dive
|
+-- hooks/                     <- Custom React hooks
+-- public/                    <- Static assets + import templates
+-- styles/                    <- Global CSS
+-- README.md                  <- You are here
```

> **Note for new developers:** Next.js requires `app/`, `components/`, `lib/` at the root level - these cannot be nested inside a subdirectory. The `database/` folder holds all SQL; the `docs/` folder explains everything else.

---

## How It Works

### Layer Overview

```
+--------------------------------------------------------------+
| FRONTEND (Browser)                                           |
| app/pages - components - TensorFlow vision                   |
+--------------------------------------------------------------+
| BACKEND (Node.js / Vercel Edge)                              |
| app/api routes - lib/actions - lib/backend                   |
+--------------------------------------------------------------+
| DATABASE (Supabase PostgreSQL + RLS)                         |
| profiles - quizzes - attempts - proctoring - certificates    |
+--------------------------------------------------------------+
```

### Request Flow

```
Browser Request
      |
      v
 app/api/route.ts          <- thin adapter only
      |
      v
 lib/backend/controllers/  <- orchestrate the request
      |
      v
 lib/backend/services/     <- apply business rules
      |
      v
 lib/backend/repositories/ <- query the database
      |
      v
 Supabase PostgreSQL       <- data
```

### Quiz Attempt Flow

```
Employee opens quiz
       |
       +- No proctoring ------------------> Start quiz immediately
       |
       +- Proctoring required
              |
              v
        Pre-check screen
         Camera - Mic - Fullscreen - Exactly one centered face - Consent
              | (all pass)
              v
        Capture baseline face signature
              |
              v
        startQuizAttempt() - creates attempt + proctoring_session
              |
              v
        Quiz player
         TF.js runs every 1.5 s
              |
         Violation detected?
           +-- YES -> POST /api/proctoring/events
           |          Evidence uploaded + risk score calculated
           |          Threshold reached? -> Auto-submit (suspicious)
           +-- NO  -> continue
              |
         Time up / last question
              |
              v
        submitQuizAttempt()
         Score - Badges - Certificate - Email
              |
              v
        Result page
```

### AI Proctoring Rules

Pre-check now captures a baseline face only when camera permission is active, lighting is acceptable, exactly one face is visible, and the face is centered. The baseline stores a browser-generated FaceMesh geometry signature and metadata on `proctoring_sessions`; the quiz will not start if zero faces or multiple faces are visible.

AI proctoring is an assistive integrity signal, not a standalone fraud verdict. Camera quality, lighting, browser performance, model loading, accessibility needs, and device differences can create false positives or false negatives, so production rollouts should pilot with real users/devices and keep manager review, retest, and appeal workflows enabled.

During the quiz, TensorFlow.js runs in the browser and sends structured events through `/api/proctoring/events`:

| Rule | Warning | Evidence / metadata |
|------|---------|---------------------|
| Multiple faces | `Multiple faces detected: 2 faces visible` | Screenshot, `detected_count`, detector counts, high risk |
| Different person | `Different person detected` | Screenshot, similarity score, threshold, critical risk |
| Face missing | `Face not visible` / no-face warning | Screenshot, confidence, medium/high risk |
| Mobile phone | `Mobile phone detected` | Screenshot, object label, confidence, high risk |
| Electronic gadget | `Laptop detected`, `Remote detected`, etc. | Screenshot, object label, confidence, high risk |

Warnings use type-specific cooldowns so the UI does not spam the employee, but ongoing violations can still create additional evidence after cooldown. Major events persist `session_id`, `attempt_id`, event type, timestamp, confidence, detected count or object label, risk delta, screenshot storage path, and metadata JSON for manager review.

### AI Provider Waterfall

```
Quiz generation / chatbot request
         |
         v
    OpenAI (primary)
         | fail / unavailable
         v
    Groq (fallback)
         | fail / unavailable
         v
    Google Gemini (fallback)
         | fail / unavailable
         v
    Template questions (never blocks the user)
```

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/itslaks/SkillTest_AI.git
cd SkillTest_AI

# 2. Install
npm install

# 3. Environment
cp .env.local.example .env.local
# Fill in Supabase URL, keys, and AI provider key

# 4. Database - run in Supabase SQL Editor in numeric order:
#    database/migrations/001_create_profiles.sql
#    database/migrations/002_create_quizzes.sql
#    ... through ...
#    database/migrations/050_proctoring_validation_program.sql

# 5. Seed (optional)
node database/seeds/seed_admin.js

# 6. Start
npm run dev
# -> http://localhost:3000
```

> Full setup guide: [docs/SETUP.md](docs/SETUP.md)

---

## Key Pages

### Employee
| Route | What it is |
|-------|-----------|
| `/employee/quizzes` | All assigned quizzes |
| `/employee/quizzes/[id]` | Quiz player (with AI proctoring) |
| `/employee/quizzes/[id]/results` | Score, certificate, feedback |
| `/employee/badges` | Badge collection |
| `/employee/leaderboard` | Live + cumulative rankings |
| `/employee/training` | Assigned training batches |

### Manager / Training Staff Console
| Route | What it is |
|-------|-----------|
| `/manager/quizzes` | Quiz management (create, edit, assign) |
| `/manager/quizzes/new` | Create quiz (manual, AI, or file upload) |
| `/manager/employees` | Employee management + domain import |
| `/manager/integrity` | AI proctoring review center |
| `/manager/analytics` | AI-powered batch and quiz insights |
| `/manager/operations` | Training batch management |
| `/manager/reports` | Excel / PDF report downloads |
| `/manager/compliance` | BRD evidence workbook |

Quick Access in the sidebar intentionally repeats high-frequency routes such as Quiz Studio, AI Commands, Risk Center, and Employees. Visibility does not mean identical permissions: RBAC still scopes what each role can read or change.

### Auth
| Route | What it is |
|-------|-----------|
| `/auth/login` | Sign in |
| `/auth/sign-up` | Register |
| `/auth/reset-password` | Password reset |

---

## Roles & Permissions

RBAC is enforced by server actions, API guards, database policies, and scoped queries. Some roles see the same page names in Quick Access, but the available data and allowed actions are different.

| Area | Admin | Manager | Coordinator | Trainer | Employee |
|------|-------|---------|-------------|---------|----------|
| Admin console / role governance | Full | No | No | No | No |
| User management | Full | Scoped employee operations | Scoped operations | Assigned learners only | No |
| Quiz Studio / create assessments | Full | Yes | Yes, training scope | Yes, training scope | No |
| Edit/delete quizzes | Full | Own/scoped | Own/scoped | Own/scoped | No |
| Assign quizzes | Full | Yes | Scoped | Assigned batch scope | No |
| AI Commands | Full | Yes | Yes, scoped | Yes, scoped | No |
| Risk Center / integrity review | Full | Scoped | Scoped | Assigned quizzes/batches only | No |
| Training batches | Full | Scoped | Scoped | Assigned only | Assigned learner view |
| Attendance | Full | Scoped | Scoped | Assigned only | No |
| Reports | All | Scoped | Scoped | Assigned/scoped training data | No |
| Proctoring evidence | Full | Scoped | Scoped | Assigned review scope | Never |
| Billing, tenant, SSO settings | Full | No | No | No | No |

Admin is the only unrestricted governance role. Manager, coordinator, and trainer share parts of the manager console for speed, but trainer access is limited to assigned batches, own/scoped quizzes, assigned learners, and assigned integrity evidence.

---

## Docs

| Document | What it covers |
|----------|---------------|
| [docs/SETUP.md](docs/SETUP.md) | Step-by-step local + production setup |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full architecture with Mermaid flow diagrams |
| [docs/TECHNICAL_OVERVIEW.md](docs/TECHNICAL_OVERVIEW.md) | Technical reference: routes, API, deployment |
| [docs/PROCTORING.md](docs/PROCTORING.md) | AI proctoring deep-dive: vision, risk, evidence, review |
| [docs/FINAL_REVIEW_AUDIT.md](docs/FINAL_REVIEW_AUDIT.md) | Final review audit: feature coverage, endpoint inventory, validation results, caveats |
| [database/README.md](database/README.md) | Migration guide and SQL file index |

---

## Changelog

### June 2026

| Area | Change |
|------|--------|
| **Proctoring** | Multiple-face banner shows exact face count; auto-clears after 30 s; type-specific cooldowns prevent alert spam |
| **Integrity Center** | `useFormStatus` loading states on review buttons; skeleton loader on page revalidation |
| **Emails** | Result links are correct; passing score is quiz-specific; certificate download included; HTML-escaped |
| **Results Page** | Fixed crash on multiple attempts; certificate card in sidebar |
| **Quiz Creation** | Certificate fields hidden until toggle is enabled |
| **Camera (2nd quiz)** | Auto-starts stream when browser permission already granted - no black screen |
| **Structure** | `scripts/` -> `database/migrations/seeds/fixes/`; root junk files removed; docs expanded |

---

## License

Private. All rights reserved.

---

## Latest Product Updates

| Area | Change |
|------|--------|
| AI Command | Added confirmation previews, audit logs, CSV/PDF chat exports, saved templates, schedule storage, scoped data access, and recent-command history. |
| AI Command | Parser moved into a tested library and now handles broken-English quiz prompts such as "plz make hard python quiz 12 mcq give to Ram by tomorrow". |
| Readiness | Quiz readiness and predicted score now use direct topic history, related domain evidence, difficulty, recency, streak, and training tenure. The UI shows confidence and evidence count so predictions are not presented as random values. |
| AI Command | Admin AI Command can shortlist candidates for role openings such as Java, RAG/data engineering, cloud, frontend, AI, and testing using assessment evidence, domain fit, credentials, attendance, and recency. |
| Profiles | `avatar-01` is now a neutral default avatar for users who have not selected a profile image; users can change it from profile settings. |

---

## AI Command Operations Copilot

AI Command is now designed as a safe operations copilot, not a generic help bot.

Core behavior:

- Data questions are answered from SkillTest_AI records instead of returning onboarding help.
- Follow-up prompts such as "only Data Engineering", "send reminder to them", and "export this" reuse the current chat context.
- Multi-step planning combines attendance, assessments, scores, pending assignments, inactivity, and proctoring risk.
- Executive mode responds to `/exec` or "Executive Summary" with organization KPIs and leadership recommendations.
- Anomaly detection handles prompts such as "Anything unusual this week?" across scores, attendance, proctoring, inactivity, and certificates.
- Root-cause explanations trace business rules for blocked users, missing certificates, failed assessments, and hidden quizzes.
- Proactive briefing loads when the console opens with critical items and recommended actions.
- Safe query builder maps natural language to predefined scoped templates instead of raw SQL.
- Drill-down actions, one-click follow-ups, editable reminder drafts, and browser voice input are available in the AI Command console.
- Data-quality scans flag duplicate emails, missing domains, invalid employee IDs, and orphan references.
- Manager dashboard includes a daily AI briefing card for quick action routing.
- Any data-changing or message-sending action creates a server-side preview first.
- Confirm / Cancel is required before employee deletes, quiz assignments, reminders, schedule creation, and other operational mutations execute.
- Pending confirmations expire after 15 minutes and cannot be confirmed by another user.
- Admins have full access; trainers, managers, and coordinators are scoped to assigned batches/employees/domains; employees cannot access AI Command.

Audit and export:

- `ai_command_audit_logs` records prompt, detected intent, action type, status, affected entities, result summary, and errors.
- `ai_command_pending_actions` stores pending action previews and confirmation tokens server-side.
- `ai_command_schedules` stores daily/weekly/monthly recurring command definitions.
- Chat responses can be exported with "export this as CSV" or "download this report as PDF".
- Exports include title, generated date, requester, filters, and response content.

Default templates:

- Weekly inactive employees
- Employees with no tests in last 10 days
- Failed employees by quiz
- Low performers below 60%
- High-risk proctoring summary
- Batch performance report
- Pending assessments
- Overdue assessments
- Domain performance comparison
- Certificate eligibility report

Scheduler deployment note:

The app stores recurring AI command schedules in `ai_command_schedules`. To execute them automatically in production, add a Vercel Cron or external worker that reads enabled schedules due at `next_run_at`, runs the stored `command_text` through the same scoped AI Command service, writes an audit log, and updates `last_run_at` / `next_run_at`. Message-sending scheduled commands must still create audit records for each execution.

---

## Production Auth And Email Checklist

Set these environment variables in production:

```bash
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
ADMIN_ALERT_EMAIL=skilltestai01@gmail.com
RESEND_API_KEY=re_... # or configure SMTP_HOST, SMTP_USER, SMTP_PASS
EMAIL_FROM="SkillTest_AI <noreply@yourdomain.com>"
```

Supabase dashboard requirements:

- Auth -> Providers -> Email: Confirm Email must be ON.
- Auth -> URL Configuration -> Site URL must match `NEXT_PUBLIC_APP_URL`.
- Auth -> URL Configuration -> Redirect URLs must include `https://your-production-domain.com/auth/callback`.
- Auth -> URL Configuration -> Redirect URLs must include `https://your-production-domain.com/auth/update-password`.
- Supabase email provider, SMTP, or Resend must be configured so signup verification and password reset emails are actually delivered.
- Production must not use localhost, Vercel preview URLs, or `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` for auth emails.

Auth behavior:

- Employee/trainer signup creates an unverified account and sends a verification email.
- Unverified employees/trainers cannot sign in or open protected routes by direct URL.
- Login shows a resend verification option when an unverified user is blocked.
- Proctoring, flag, and security alert emails are sent to `ADMIN_ALERT_EMAIL`; for this deployment that is `skilltestai01@gmail.com`.

Employee Auth repair:

```bash
npm run cleanup:auth-user -- employee@example.com
```

Use this only for a stuck deleted employee email. The script uses the Supabase Admin API, keeps active profiles, and deletes only orphan employee Auth users.

---

**Built for training teams that need execution, evidence, and insight in one place.**
