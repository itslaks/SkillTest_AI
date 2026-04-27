# Maverick Execution Platform - TMS

Maverick Execution Platform - TMS is a centralized Training Management System for managing the complete training lifecycle: batch creation, candidate onboarding, attendance, assessments, trainer coordination, feedback, dashboards, topper identification, governance controls, and reporting.

The product is designed for training teams that want to replace spreadsheet-driven follow-ups with a disciplined execution platform that is visible, auditable, and presentation-ready.

## What This Solves

Training operations are often split across spreadsheets, chat groups, email reminders, quiz tools, and manual reports. Maverick TMS brings those workflows into one system so coordinators and leaders can answer:

- Which batches are planned, running, completed, or closed?
- Which trainers own each batch?
- Which candidates are absent repeatedly?
- Was attendance submitted before the cut-off?
- Which assessments are scheduled and uploaded?
- Who are the toppers, and how was the score calculated?
- Which candidates are discontinued, not cleared, offered, or onboarded?
- What feedback did candidates give about content quality and trainer effectiveness?
- What audit trail exists for attendance, status changes, notifications, and admin changes?

## BRD Coverage

### Role-Based Workspaces

- **Admin**: role management, governance thresholds, topper criteria, cut-offs, audit logs.
- **Training Coordinator / Manager**: batch lifecycle, candidate import, trainer assignment, scheduling, automation checks, feedback windows, reports.
- **Trainer**: assigned-batch workspace, attendance upload, assessment score upload, project evaluation upload.
- **Candidate**: batch details, sessions, attendance history, reminders, linked assessments, structured feedback.

### Training Operations

- Batch lifecycle with `Planned`, `Running`, `Completed`, and `Closed` statuses.
- Multi-trainer assignment with lead trainer and trainer panel support.
- Batch editing for schedule, status, dates, description, domain, and trainers.
- Candidate onboarding by manual selection or Excel batch-candidate upload.
- Session planning with trainer, date/time, mode, status, agenda, and attendance requirement.

### Attendance Management

- Manual attendance marking.
- Excel attendance upload with template support.
- Attendance cut-off governance setting.
- Dashboard risks for missed attendance and absence streaks.
- Versioned attendance history with old status, new status, source, timestamp, and changed-by user.

### Assessment Management

- Assessment setup by batch with type, schedule, Excel template, question file, max score, passing score, and status.
- Assessment score upload for trainers and coordinators.
- Validation for candidate existence, score ranges, duplicate rows, and upload errors.
- Upload error logs visible in Training Ops.
- Existing quiz/adaptive assessment engine remains available for linked assessments.

### Project Evaluation

- Project evaluation upload as a first-class TMS workflow.
- Tracks candidate, batch, evaluator, project title, score, evidence filename, and remarks.
- Project score feeds topper calculation.

### Notifications and Automation

The platform includes a governance simulation panel for BRD alert events:

- Attendance cut-off missed.
- Consecutive absence streak.
- Upcoming assessment reminder.
- Feedback window reminder.

All notification records are logged with channel, status, timestamp, audience, and message.

### Feedback Management

- Training Coordinator can open feedback windows.
- Candidate feedback captures:
  - overall rating
  - training content quality
  - trainer effectiveness
  - free-text feedback
  - suggested action item
- Feedback is stored batch/session-wise and exported in reports.

### Topper Identification

- Visible Topper Center in Reports.
- Uses configurable admin criteria:
  - assessment weight
  - project weight
  - minimum attendance threshold
- Shows transparent calculation inputs: assessment score, project score, attendance, final topper score.
- Topper data is included in the Training Ops Excel workbook.

### Reports

The Report Center includes:

- Training Ops Excel export.
- Training Ops PDF export.
- Quiz/assessment reports.
- Consolidated batch filter metrics:
  - discontinued
  - not cleared
  - offered
  - onboarded / active
- Exported workbook sheets for batch summary, candidate status, attendance, assessment setup, assessment uploads, project evaluations, topper criteria, topper candidates, feedback, notifications, and automation runs.

### Governance and Audit

- Admin Governance Console for user roles and settings.
- Attendance cut-off time.
- Absence alert day threshold.
- Feedback window default.
- Topper weights and minimum attendance.
- Admin audit log for sensitive role/governance changes.
- Batch status audit and batch change audit.
- Attendance version audit.
- Upload and notification logs.

## AI Intelligence Layer

Maverick TMS also includes an assessment intelligence layer:

- Predictive readiness scoring.
- Cognitive load detection.
- Panic-mode / fast wrong-answer pattern detection.
- Anti-gaming / memorization detection.
- Batch DNA fingerprinting.
- Trainer impact scoring.
- Knowledge decay tracking.

Core intelligence logic lives in:

- [`lib/insights.ts`](./lib/insights.ts)
- [`lib/actions/employee.ts`](./lib/actions/employee.ts)
- [`components/manager/intelligence-dashboard.tsx`](./components/manager/intelligence-dashboard.tsx)

## Important Routes

| Route | Purpose |
| --- | --- |
| `/` | Maverick TMS landing page |
| `/auth/login` | Login |
| `/manager` | Coordinator / manager dashboard |
| `/manager/operations` | Batch lifecycle, trainer workspace, attendance, assessment uploads, project evaluation, automation |
| `/manager/admin` | Admin governance console |
| `/manager/reports` | BRD report center and topper center |
| `/manager/analytics` | AI analytics cockpit |
| `/manager/employees` | Candidate master and assignment management |
| `/manager/quizzes` | Assessment / quiz management |
| `/employee` | Candidate dashboard |
| `/employee/training` | Candidate training hub, attendance, reminders, feedback |
| `/employee/quizzes` | Assigned assessments |

## Key Implementation Files

| Area | Files |
| --- | --- |
| Training server actions | [`lib/actions/training.ts`](./lib/actions/training.ts) |
| RBAC helpers | [`lib/rbac.ts`](./lib/rbac.ts) |
| Training Ops UI | [`app/manager/operations/page.tsx`](./app/manager/operations/page.tsx) |
| Admin console | [`app/manager/admin/page.tsx`](./app/manager/admin/page.tsx) |
| Report center | [`app/manager/reports/page.tsx`](./app/manager/reports/page.tsx) |
| Assessment score upload | [`components/manager/assessment-score-importer.tsx`](./components/manager/assessment-score-importer.tsx) |
| Attendance upload | [`components/manager/attendance-importer.tsx`](./components/manager/attendance-importer.tsx) |
| Training Ops Excel export | [`app/api/reports/training-ops/download/route.ts`](./app/api/reports/training-ops/download/route.ts) |
| Training schema completion | [`scripts/024_complete_brd_tms_controls.sql`](./scripts/024_complete_brd_tms_controls.sql) |

## Database Setup

Run the SQL scripts in `scripts/` in order through the Supabase SQL editor. The latest TMS completion migration is:

```text
scripts/024_complete_brd_tms_controls.sql
```

It is defensive and creates the assessment import/result tables if an older environment has not run `012_create_assessment_imports.sql`.

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

OPENAI_API_KEY=your_openai_key
GOOGLE_GEMINI_API_KEY=your_gemini_key

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is required for admin-style import/export flows.
- At least one AI key is needed for AI generation features.

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI primitives | Radix UI |
| Auth + DB | Supabase |
| Charts | Recharts |
| File import/export | SheetJS / xlsx |
| AI integrations | OpenAI + Gemini fallback |
| Analytics | Vercel Analytics |

## Local Development

Install dependencies:

```bash
npm install
```

Start dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Verification

Current validation:

```bash
npm run lint
npm run build
```

Both pass on the TMS completion branch.

## Contest Positioning

Most submissions will likely focus on quizzes, dashboards, or a simple LMS-style flow. Maverick TMS is positioned as a full execution platform:

- operational workflows
- role-specific workspaces
- trainer accountability
- automated governance checks
- visible audit trails
- transparent topper logic
- BRD-aligned reporting
- AI-powered learning intelligence

That combination is the core differentiator.

## License

MIT
