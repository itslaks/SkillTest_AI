# SkillTest_AI — Mavericks Execution Platform

> AI-powered Training Management System for enterprise learning teams.  
> Quizzes · AI Proctoring · Certificates · Attendance · Reports · Gamification — in one Next.js app.

---

## 🗂️ Table of Contents

- [What is this?](#-what-is-this)
- [Who uses it?](#-who-uses-it)
- [Feature Map](#-feature-map)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [How it Works — Architecture](#-how-it-works--architecture)
- [Quick Start](#-quick-start)
- [Key Pages](#-key-pages)
- [Roles & Permissions](#-roles--permissions)
- [Docs](#-docs)
- [Changelog](#-changelog)

---

## 🧭 What is this?

SkillTest_AI runs the full lifecycle of employee training and assessment:

```
Onboard employees → Assign quizzes → Run proctored tests
→ Auto-score → Issue certificates → Generate reports → Prove compliance
```

It is built for training managers and HR teams who need **execution evidence**, not just a quiz screen.

---

## 👥 Who uses it?

| Role | Color | What they do |
|------|-------|-------------|
| 👑 Admin | 🔴 Red | Full platform control — user governance, approvals, all reports |
| 🧑‍💼 Manager | 🟠 Orange | Create quizzes, assign employees, run analytics, review proctoring |
| 🗂️ Training Coordinator | 🟡 Yellow | Manage batches, attendance, score uploads, feedback windows |
| 🧑‍🏫 Trainer | 🟢 Green | Mark attendance, upload scores, submit evaluations for assigned batches |
| 🧑‍🎓 Employee | 🔵 Blue | Take quizzes, earn badges, view certificates, track leaderboard |

---

## ✨ Feature Map

### 🔵 Employee Features
| Feature | Description |
|---------|-------------|
| 🎯 Adaptive Quiz Engine | Questions reorder by difficulty based on live performance signals |
| 🛡️ AI Proctoring | Camera · baseline face identity · multiple-face detection · gadget detection · gaze tracking · browser lock |
| 🏅 Certificates | Auto-issued on pass; downloadable with custom title, message, and template |
| 🎖️ Badge Universe | 250+ badges across 12 categories earned from quiz performance and streaks |
| 🏆 Leaderboard | Live and cumulative rankings with points and streaks |
| 🧑‍🎓 AI Learner Coach | Personalized recommendations based on quiz history and retention signals |

### 🟠 Manager Features
| Feature | Description |
|---------|-------------|
| 🤖 AI Quiz Generation | Generate MCQs from a topic, uploaded file, or natural-language command |
| 🔍 Integrity Center | Review flagged attempts with evidence thumbnails, approve/reject/retest |
| 🧠 AI Insights | Batch health, trainer performance, and quiz outcome coaching |
| 📊 Assessment Analyzer | Upload score sheets and chat with AI about weak areas |
| 🤖 Command Chatbot | "Create quiz on Python, assign to Ram" → quiz created |
| 📥 Import Workflows | Employees, quiz questions, attendance, scores — CSV/XLSX/DOCX/PDF/XML/JSON |
| 📄 Reports | Excel + PDF exports for attendance, assessment, feedback, toppers |
| 🧾 BRD Evidence Pack | Downloadable compliance workbook for judges / clients |

### 🟡 Training Operations
| Feature | Description |
|---------|-------------|
| 📋 Batch Management | Create batches, assign trainers and learners, link assessments |
| ✅ Attendance | Cutoff enforcement, late reasons, version history, bulk import |
| 📝 Project Evaluations | Trainer-submitted evaluation forms per batch |
| 📬 Email Automation | Assignment, completion, and proctoring alert emails via SMTP or Resend |

---

## 🧰 Tech Stack

| Layer | Technology | Color |
|-------|-----------|-------|
| Framework | Next.js 16 App Router | 🔵 |
| Language | TypeScript + TSX | 🔵 |
| UI | React 19 · Tailwind CSS 4 · shadcn/Radix | 🟣 |
| Auth | Supabase Auth | 🟠 |
| Database | Supabase PostgreSQL + Row-Level Security | 🟢 |
| AI | OpenAI → Groq → Gemini (waterfall fallback) | 🟡 |
| Vision | TensorFlow.js (face · gaze · object detection) | 🟣 |
| Email | Nodemailer (SMTP) or Resend API | 🔵 |
| Excel | SheetJS `xlsx` | 🟢 |
| PDF | `jspdf` + `jspdf-autotable` | 🔴 |
| Charts | Recharts | 🟠 |
| Deployment | Vercel | 🔵 |

---

## 📁 Project Structure

```
SkillTest_AI/
│
├── 📂 app/                    🔵 FRONTEND — Next.js pages + API routes
│   ├── api/                   ← REST endpoints (AI, proctoring, exports, imports)
│   ├── auth/                  ← Login, sign-up, reset password
│   ├── employee/              ← Employee workspace (quizzes, badges, training)
│   ├── manager/               ← Manager workspace (quizzes, analytics, integrity)
│   └── certificates/          ← Public certificate viewer
│
├── 📂 components/             🟣 FRONTEND — Reusable React components
│   ├── ui/                    ← Base shadcn/Radix components (50+)
│   ├── manager/               ← Manager-specific widgets
│   ├── employee/              ← Employee-specific widgets
│   └── avatar/ · landing/ · quiz/ · certificates/ · ...
│
├── 📂 lib/                    🟠 BACKEND — Business logic & utilities
│   ├── actions/               ← Next.js server actions (form handlers)
│   ├── backend/               ← Controllers → Services → Repositories
│   │   ├── controllers/       ← Route orchestration
│   │   ├── services/          ← Business rules
│   │   └── repositories/      ← Database queries
│   ├── security/              ← Zod validation, rate limiting
│   ├── supabase/              ← DB client helpers
│   ├── proctoring.ts          ← Risk weights & thresholds
│   ├── proctoring-server.ts   ← Server-side session & evidence
│   ├── proctoring-vision.ts   ← Browser TensorFlow detection
│   ├── email.ts               ← Email builder (SMTP / Resend)
│   └── rbac.ts                ← Role access control
│
├── 📂 database/               🟢 DATABASE — All SQL and seed files
│   ├── migrations/            ← 001–040 sequential schema migrations
│   ├── seeds/                 ← Seed data and fixture generators
│   └── fixes/                 ← One-off patches (already applied)
│
├── 📂 docs/                   📚 DOCUMENTATION
│   ├── ARCHITECTURE.md        ← Full architecture with flow diagrams
│   ├── SETUP.md               ← Step-by-step local setup
│   ├── TECHNICAL_OVERVIEW.md  ← Technical reference
│   └── PROCTORING.md          ← AI proctoring deep-dive
│
├── 📂 hooks/                  ← Custom React hooks
├── 📂 public/                 ← Static assets + import templates
├── 📂 styles/                 ← Global CSS
└── README.md                  ← You are here
```

> **Note for new developers:** Next.js requires `app/`, `components/`, `lib/` at the root level — these cannot be nested inside a subdirectory. The `database/` folder holds all SQL; the `docs/` folder explains everything else.

---

## 🏗️ How it Works — Architecture

### Layer Overview

```
┌──────────────────────────────────────────────────────────────┐
│  🔵 FRONTEND  (Browser)                                      │
│  app/ pages  ·  components/  ·  TensorFlow vision            │
├──────────────────────────────────────────────────────────────┤
│  🟠 BACKEND  (Node.js / Vercel Edge)                         │
│  app/api/ routes  ·  lib/actions/  ·  lib/backend/           │
├──────────────────────────────────────────────────────────────┤
│  🟢 DATABASE  (Supabase PostgreSQL + RLS)                     │
│  profiles · quizzes · attempts · proctoring · certificates   │
└──────────────────────────────────────────────────────────────┘
```

### Request Flow

```
Browser Request
      │
      ▼
🔵 app/api/route.ts          ← thin adapter only
      │
      ▼
🟠 lib/backend/controllers/  ← orchestrate the request
      │
      ▼
🟠 lib/backend/services/     ← apply business rules
      │
      ▼
🟠 lib/backend/repositories/ ← query the database
      │
      ▼
🟢 Supabase PostgreSQL       ← data
```

### Quiz Attempt Flow

```
Employee opens quiz
       │
       ├─ No proctoring ──────────────────► Start quiz immediately
       │
       └─ Proctoring required
              │
              ▼
       🔵 Pre-check screen
         Camera · Mic · Fullscreen · Exactly one centered face · Consent
              │ (all pass)
              ▼
       🔵 Capture baseline face signature
              │
              ▼
       🟠 startQuizAttempt() — creates attempt + proctoring_session
              │
              ▼
       🔵 Quiz player
         TF.js runs every 1.5 s
              │
         Violation detected?
           ├── YES → POST /api/proctoring/events
           │          Evidence uploaded + risk score calculated
           │          Threshold reached? → 🔴 Auto-submit (suspicious)
           └── NO  → continue
              │
         Time up / last question
              │
              ▼
       🟠 submitQuizAttempt()
         Score · Badges · Certificate · Email
              │
              ▼
       🔵 Result page
```

### AI Proctoring Rules

Pre-check now captures a baseline face only when camera permission is active, lighting is acceptable, exactly one face is visible, and the face is centered. The baseline stores a browser-generated FaceMesh geometry signature and metadata on `proctoring_sessions`; the quiz will not start if zero faces or multiple faces are visible.

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
         │
         ▼
   🟡 OpenAI (primary)
         │ fail / unavailable
         ▼
   🟡 Groq (fallback)
         │ fail / unavailable
         ▼
   🟡 Google Gemini (fallback)
         │ fail / unavailable
         ▼
   📝 Template questions (never blocks the user)
```

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/itslaks/SkillTest_AI.git
cd SkillTest_AI

# 2. Install
npm install

# 3. Environment
cp .env.local.example .env.local
# Fill in Supabase URL, keys, and AI provider key

# 4. Database — run in Supabase SQL Editor in order:
#    database/migrations/001_create_profiles.sql
#    database/migrations/002_create_quizzes.sql
#    ... through ...
#    database/migrations/043_cleanup_orphan_employee_auth_users.sql

# 5. Seed (optional)
node database/seeds/seed_admin.js

# 6. Start
npm run dev
# → http://localhost:3000
```

> 📖 Full setup guide: [docs/SETUP.md](docs/SETUP.md)

---

## 🗺️ Key Pages

### 🔵 Employee
| Route | What it is |
|-------|-----------|
| `/employee/quizzes` | All assigned quizzes |
| `/employee/quizzes/[id]` | Quiz player (with AI proctoring) |
| `/employee/quizzes/[id]/results` | Score, certificate, feedback |
| `/employee/badges` | Badge collection |
| `/employee/leaderboard` | Live + cumulative rankings |
| `/employee/training` | Assigned training batches |

### 🟠 Manager
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

### 🟡 Auth
| Route | What it is |
|-------|-----------|
| `/auth/login` | Sign in |
| `/auth/sign-up` | Register |
| `/auth/reset-password` | Password reset |

---

## 🔐 Roles & Permissions

| Area | 🔴 Admin | 🟠 Manager | 🟡 Coordinator | 🟢 Trainer | 🔵 Employee |
|------|---------|-----------|---------------|-----------|------------|
| User management | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| Quiz create/edit | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign quizzes | ✅ | ✅ | ❌ | ❌ | ❌ |
| Take quizzes | ❌ | ❌ | ❌ | ❌ | ✅ |
| Proctoring review | ✅ | ✅ | ✅ | ❌ | ❌ |
| Training batches | ✅ | ✅ | ✅ | Assigned only | ❌ |
| Attendance | ✅ | ✅ | ✅ | Assigned only | ❌ |
| Reports | ✅ All | ✅ Scoped | ✅ Scoped | ❌ | ❌ |
| Proctoring evidence | ✅ | ✅ | ✅ | ❌ | ❌ Never |

---

## 📚 Docs

| Document | What it covers |
|----------|---------------|
| [docs/SETUP.md](docs/SETUP.md) | Step-by-step local + production setup |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full architecture with Mermaid flow diagrams |
| [docs/TECHNICAL_OVERVIEW.md](docs/TECHNICAL_OVERVIEW.md) | Technical reference: routes, API, deployment |
| [docs/PROCTORING.md](docs/PROCTORING.md) | AI proctoring deep-dive: vision, risk, evidence, review |
| [database/README.md](database/README.md) | Migration guide and SQL file index |

---

## 📝 Changelog

### June 2026

| Area | Change |
|------|--------|
| 🛡️ **Proctoring** | Multiple-face banner shows exact face count; auto-clears after 30 s; type-specific cooldowns prevent alert spam |
| ⚙️ **Integrity Center** | `useFormStatus` loading states on review buttons; skeleton loader on page revalidation |
| ✉️ **Emails** | Result links are correct; passing score is quiz-specific; certificate download included; HTML-escaped |
| 📄 **Results Page** | Fixed crash on multiple attempts; certificate card in sidebar |
| 🎯 **Quiz Creation** | Certificate fields hidden until toggle is enabled |
| 📷 **Camera (2nd quiz)** | Auto-starts stream when browser permission already granted — no black screen |
| 📁 **Structure** | `scripts/` → `database/migrations/seeds/fixes/`; root junk files removed; docs expanded |

---

## 📄 License

Private. All rights reserved.

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

---

**Built for training teams that need execution, evidence, and insight in one place.**
