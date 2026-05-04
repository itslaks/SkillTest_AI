# 🚀 Maverick Execution Platform

## Training Management System (TMS)

> A modern execution and governance platform for training batches, candidates, trainers, attendance, assessments, feedback, alerts, dashboards, and reports.

Built as a contest-ready, BRD-aligned Training Management System for non-technical Admins, Training Coordinators, Trainers, and Employees.

---

## ✨ Why This Project Stands Out

Maverick TMS is not just another dashboard. It is designed like an operations control room: every important action is visible, every workflow is guided, and every metric helps teams act faster.

### 🏆 Competition Differentiators

- 🎯 **Maverick command-center UI** with visible quick actions for non-technical users
- 📊 **Batch-wise comparison dashboard** across attendance, clearance, outcomes, and training health
- 🧬 **Batch DNA radar chart** for side-by-side execution quality
- 👨‍🏫 **Trainer scorecards** with batch count, attendance impact, assessment averages, and feedback ratings
- ✅ **Assessment clearance rate** calculated per batch across assessment types
- 📅 **Schedule timeline** for sessions, assessments, feedback windows, and milestones
- 🧾 **Candidate status management** for active, discontinued, not-cleared, offered, and onboarded candidates
- 📁 **Real evidence/question-file uploads** through Supabase Storage
- 💬 **Feedback analytics** with standalone reporting support
- 🤖 **AI and behavioral insights** for readiness, cognitive load, knowledge decay, and trainer impact
- 🔔 **Automated governance alerts** for missed attendance, absence streaks, assessment reminders, and feedback follow-ups

---

## 📌 Business Purpose

The platform centralizes the complete training lifecycle:

- Batch creation and lifecycle governance
- Candidate onboarding and batch assignment
- Trainer coordination
- Attendance tracking
- Excel-based assessment score uploads
- Project evaluation evidence
- Feedback initiation and analysis
- Topper identification
- Dashboards and exportable reports
- Audit logs, notification logs, and automation history

It replaces manual spreadsheet follow-ups with a controlled, auditable, system-driven workflow.

---

## 👥 User Roles

| Role | Main Responsibilities |
|---|---|
| 🛡️ Admin | Manage users, roles, trainers, settings, topper criteria, and governance controls |
| 🧭 Training Coordinator / Manager | Create batches, manage schedules, upload candidates, monitor dashboards, trigger feedback, download reports |
| 👨‍🏫 Trainer | Upload attendance, assessment scores, project scores, evidence files, and daily execution inputs |
| 👩‍🎓 Employee / Candidate | View training details, take assigned assessments, track progress, and submit feedback |

RBAC is enforced through server-side route checks, Supabase role data, and scoped access helpers.

---

## ✅ BRD Coverage

| BRD Area | Status | Implementation |
|---|---:|---|
| Batch lifecycle management | ✅ Complete | Planned, Running, Completed, Closed lifecycle with candidate mapping |
| Candidate onboarding | ✅ Complete | Excel import, validation, duplicate detection, row-level errors |
| Trainer coordination | ✅ Complete | Trainer assignment, trainer approval, trainer-scoped access |
| Attendance tracking | ✅ Complete | Manual entry, Excel upload, cut-off logic, absence streak tracking |
| Assessment score tracking | ✅ Complete | Excel uploads, score validation, assessment setup, clearance metrics |
| Notifications and alerts | ✅ Complete | Resend email support, dispatch logs, Vercel cron automation |
| Feedback management | ✅ Complete | Feedback windows, reminders, responses, analytics, exports |
| Dashboards and metrics | ✅ Complete | Operations dashboard, trainer metrics, batch comparison, clearance rates |
| Reports and downloads | ✅ Complete | Attendance, assessment, feedback, toppers, consolidated, PDF/Excel exports |
| Topper identification | ✅ Complete | Configurable scoring and reproducible ranking logic |
| Audit and logging | ✅ Complete | Upload logs, notification logs, automation runs, modification tracking |
| Non-technical UI | ✅ Improved | Visible actions, stronger contrast, hints, quick-action layout |

---

## 🧩 Core Features

### 🎓 Batch Management

- Create, edit, complete, and close batches
- Assign one or more trainers
- Define schedules, assessment dates, and feedback windows
- Upload candidate master data through Excel
- Manage candidate lifecycle status directly

### 🕘 Attendance Tracker

- Manual attendance entry
- Excel attendance upload
- Configurable 10:00 AM cut-off
- Duplicate, missing candidate, and invalid batch validation
- Row-level validation feedback
- Consecutive absence alerts
- Versioned attendance records and upload logs

### 🧪 Assessment Tracker

- Sprint review, API/coding, coding, project, and custom assessment types
- Excel score uploads
- Candidate and batch mapping validation
- Score range validation
- Duplicate upload detection
- Project evidence and question-file upload support

### 🔔 Notifications and Governance

- Attendance not submitted before cut-off
- Three-day continuous absence alerts
- Successful attendance and assessment upload confirmations
- Upcoming assessment reminders
- Feedback request and closure reminders
- Notification logs with timestamp and recipient details
- Scheduled automation through Vercel Cron

### 💬 Feedback Management

- Coordinator-triggered feedback collection
- Feedback windows and closure timelines
- Training content quality ratings
- Trainer effectiveness ratings
- Batch-wise storage and analytics
- Standalone and consolidated feedback reporting

### 📊 Dashboards and Reports

- Total candidates
- Discontinued candidates
- Not-cleared candidates
- Offered/onboarded candidates
- Remaining candidates in training
- Attendance percentage per batch
- Assessment clearance rate
- Trainer-wise performance metrics
- Batch-wise comparison across programs
- Topper lists per batch and across batches
- Excel and PDF exports

---

## 🎨 UI/UX Direction

The application is designed for non-technical users, so the interface intentionally avoids hidden workflows.

- Important actions are visible in the manager quick-action strip
- Navigation labels include helpful descriptions
- Form text and dashboard labels use stronger contrast
- Landing page copy explains the system in plain business language
- Mobile navigation is explicit and readable
- Motion is smoother and respects reduced-motion preferences
- The look is customized for a training operations platform, not a generic AI template

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui, Radix UI |
| Icons | lucide-react |
| Charts | Recharts |
| Reports | xlsx, jsPDF |
| Email | Resend |
| Validation | Zod |
| Browser Tests | Playwright |

---

## 📂 Project Structure

```text
app/
  api/                 API routes for imports, exports, cron, AI, reports
  auth/                Login, sign-up, reset password, approval screens
  employee/            Employee/candidate portal
  manager/             Admin, coordinator, trainer, operations, reports

components/
  landing/             Public landing experience
  manager/             Manager dashboards, importers, reports, navigation
  employee/            Candidate-facing UI
  ui/                  Shared shadcn/Radix primitives

lib/
  actions/             Server actions and training automation logic
  supabase/            Supabase clients
  training-access.ts   Role and batch access helpers
  types/               Shared TypeScript definitions

scripts/
  *.sql                Supabase migrations
  browser-smoke.js     Smoke test script
```

---

## ⚙️ Environment Setup

Copy `.env.example` or `.env.local.example` into `.env.local`, then configure:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=replace_with_a_long_random_secret

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Maverick TMS <noreply@yourdomain.com>

OPENAI_API_KEY=optional
GOOGLE_GEMINI_API_KEY=optional
```

### 🔐 Important Production Notes

- `CRON_SECRET` must be a long random value in production.
- Resend configuration is required for email alerts and reminders.
- Supabase Storage buckets/policies must allow approved evidence and question-file uploads.
- Supabase SQL migrations must be applied before production demos.

---

## 🗄️ Database Migrations

Run the SQL scripts from `scripts/` in order, starting at:

```text
scripts/001_create_profiles.sql
```

Continue through the latest migration, including:

```text
scripts/024_complete_brd_tms_controls.sql
scripts/025_trainer_approval.sql
```

These scripts enable the BRD-aligned TMS controls, approval workflow, audit tables, automation logs, and governance data.

---

## 🚦 Scheduled Automation

The app includes a secure cron route:

```text
GET /api/cron/training-governance
```

Configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/training-governance",
      "schedule": "30 4 * * *"
    }
  ]
}
```

The route runs:

- Attendance cut-off checks
- Absence streak checks
- Assessment reminders
- Feedback reminders

Manual secure trigger:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://your-app.vercel.app/api/cron/training-governance"
```

---

## ▶️ Run Locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 🧪 Verification

Run the production build:

```bash
npm run build
```

Run the smoke test:

```bash
npm run test:smoke
```

Optional lint check:

```bash
npm run lint
```

---

## 🔑 Demo Routes

| Screen | Route |
|---|---|
| Landing Page | `/` |
| Login | `/auth/login` |
| Manager Dashboard | `/manager` |
| Admin Governance | `/manager/admin` |
| Operations Control Room | `/manager/operations` |
| Reports / Evidence Desk | `/manager/reports` |
| Employee Training Hub | `/employee/training` |

---

## 👤 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@hexaware.com` | `Zxcv,0987` |
| Trainer | `trainer@hexaware.com` | `Asdf,1234` |

> Update these credentials before any real deployment.

---

## 🏁 Contest Demo Flow

1. 🚀 Start on the landing page and show the customized Maverick experience.
2. 🧭 Log in as manager/admin and open the operations control room.
3. 📊 Show batch comparison, trainer scorecards, clearance rates, and status metrics.
4. 🕘 Upload attendance and explain cut-off plus absence alerts.
5. 🧪 Upload assessment scores and evidence files.
6. 💬 Trigger feedback and show feedback analytics.
7. 🏆 Generate toppers and download reports.
8. 🔔 Show automation credibility: cron, logs, alerts, and audit evidence.

---

## 📜 License

Internal academic/capstone use for the Maverick Execution Platform.

