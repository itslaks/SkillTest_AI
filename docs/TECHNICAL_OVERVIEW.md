# SkillTest AI Technical Overview

This document is a compact owner guide for the SkillTest AI codebase. It explains what the app is built with, how it is organized, what APIs exist, and how to run, test, and deploy it.

## 1. Product Summary

SkillTest AI is a web-based training management and assessment platform. It supports:

- Public landing and authentication pages.
- Admin, manager, training coordinator, trainer, and employee roles.
- Quiz creation, assignment, imports, attempts, results, and leaderboards.
- Training batch lifecycle management.
- Attendance import and tracking.
- Assessment score import and project evaluation.
- Feedback windows, feedback sentiment charts, and training reports.
- AI-powered quiz generation, manager insights, employee recommendations, and assessment chat.
- Excel and PDF exports for operations, reports, attendance, feedback, assessments, employees, and leaderboards.

## 2. Language And Framework

| Area | Technology |
| --- | --- |
| Main language | TypeScript |
| UI language | TSX, React components |
| Framework | Next.js 16 App Router |
| React version | React 19 |
| Runtime | Node.js 20.9 or newer for Next.js 16 |
| Styling | Tailwind CSS 4 with shadcn/Radix-style UI components |
| Database/auth | Supabase PostgreSQL and Supabase Auth |
| AI providers | OpenAI Chat Completions first, Google Gemini fallback |
| Email | Resend |
| Charts | Recharts |
| Excel | SheetJS `xlsx` |
| PDF | `jspdf` and `jspdf-autotable` |
| Browser tests | Playwright |
| Deployment target | Vercel-compatible Next.js app |

## 3. Main Folder Structure

```text
app/
  page.tsx                     Public landing page
  layout.tsx                   Root app layout, fonts, analytics, toaster
  auth/                        Login, signup, password reset, auth callback
  employee/                    Employee dashboard, quizzes, badges, training
  manager/                     Manager/admin/trainer dashboards and operations
  api/                         Route handlers for AI, exports, imports, reports

components/
  ui/                          Shared UI primitives
  landing/                     Public marketing/landing components
  employee/                    Employee-specific widgets
  manager/                     Manager/training operations widgets
  insights/                    Dashboard insight visual components

lib/
  actions/                     Server actions for auth, quiz, employee, manager, training
  supabase/                    Supabase server/client/proxy helpers
  security/                    Validation, env, and rate-limit helpers
  ai.ts                        Shared OpenAI/Gemini helper
  rbac.ts                      Role-based access control
  training-access.ts           Batch/training access helpers
  topper.ts                    Score/topper calculation helpers

scripts/
  *.sql                        Supabase database migrations
  browser-smoke.js             Playwright smoke test
  generate-tms-upload-fixtures.js
```

## 4. App Pages

### Public And Auth Pages

| URL | File | Purpose |
| --- | --- | --- |
| `/` | `app/page.tsx` | Public landing page |
| `/auth/login` | `app/auth/login/page.tsx` | User sign in |
| `/auth/sign-up` | `app/auth/sign-up/page.tsx` | User registration |
| `/auth/sign-up-success` | `app/auth/sign-up-success/page.tsx` | Post-signup confirmation |
| `/auth/pending-approval` | `app/auth/pending-approval/page.tsx` | Account approval waiting state |
| `/auth/reset-password` | `app/auth/reset-password/page.tsx` | Password reset request |
| `/auth/update-password` | `app/auth/update-password/page.tsx` | Password update form |
| `/auth/error` | `app/auth/error/page.tsx` | Auth error page |
| `/auth/callback` | `app/auth/callback/route.ts` | Supabase auth callback |

### Manager, Trainer, Coordinator, Admin Pages

| URL | File | Purpose |
| --- | --- | --- |
| `/manager` | `app/manager/page.tsx` | Manager command dashboard |
| `/manager/admin` | `app/manager/admin/page.tsx` | Admin console |
| `/manager/analytics` | `app/manager/analytics/page.tsx` | Analytics and AI assessment analysis |
| `/manager/employees` | `app/manager/employees/page.tsx` | Employee management and import |
| `/manager/leaderboard` | `app/manager/leaderboard/page.tsx` | Manager leaderboard |
| `/manager/operations` | `app/manager/operations/page.tsx` | Training operations control room |
| `/manager/quizzes` | `app/manager/quizzes/page.tsx` | Quiz list and management |
| `/manager/quizzes/new` | `app/manager/quizzes/new/page.tsx` | Create quiz |
| `/manager/quizzes/[id]` | `app/manager/quizzes/[id]/page.tsx` | Quiz details |
| `/manager/quizzes/[id]/edit` | `app/manager/quizzes/[id]/edit/page.tsx` | Edit quiz |
| `/manager/reports` | `app/manager/reports/page.tsx` | Reports and exports |
| `/manager/settings` | `app/manager/settings/page.tsx` | Manager settings |

### Employee Pages

| URL | File | Purpose |
| --- | --- | --- |
| `/employee` | `app/employee/page.tsx` | Employee dashboard |
| `/employee/badges` | `app/employee/badges/page.tsx` | Badges and achievements |
| `/employee/leaderboard` | `app/employee/leaderboard/page.tsx` | Employee leaderboard |
| `/employee/quizzes` | `app/employee/quizzes/page.tsx` | Assigned quizzes |
| `/employee/quizzes/[quizId]` | `app/employee/quizzes/[quizId]/page.tsx` | Quiz start/details |
| `/employee/quizzes/[quizId]/leaderboard` | `app/employee/quizzes/[quizId]/leaderboard/page.tsx` | Quiz leaderboard |
| `/employee/quizzes/[quizId]/results` | `app/employee/quizzes/[quizId]/results/page.tsx` | Quiz results |
| `/employee/training` | `app/employee/training/page.tsx` | Training schedule, attendance, reminders, feedback |
| `/demo/leaderboard` | `app/demo/leaderboard/page.tsx` | Demo leaderboard |

## 5. API Endpoints

All endpoints are Next.js App Router route handlers under `app/api` unless noted.

### Health And AI

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Checks required Supabase environment variables |
| `GET` | `/api/ai-status` | Reports AI provider configuration/status |
| `POST` | `/api/ai-chat` | Manager assessment chat using uploaded/imported assessment context |
| `GET` | `/api/ai-chat` | Returns chat-related data or status for assessment analysis |
| `POST` | `/api/ai-insight` | Short AI insight for manager dashboards |
| `POST` | `/api/ai-recommend` | Employee learning recommendation |
| `POST` | `/api/generate-questions` | Generate quiz questions from a topic |
| `POST` | `/api/generate-from-content` | Generate quiz questions from extracted/uploaded content |
| `POST` | `/api/extract-content` | Extract text from uploaded content, including supported documents |

### Imports And Templates

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/assessment-import` | Import assessment scores |
| `GET` | `/api/assessment-import` | Retrieve assessment import data/status |
| `POST` | `/api/training/attendance-import` | Bulk import attendance records |
| `GET` | `/api/training/attendance-template` | Download attendance upload template |
| `POST` | `/api/training/batch-candidate-import` | Bulk import/enroll batch candidates |
| `GET` | `/api/training/batch-candidate-template` | Download batch candidate upload template |
| `GET` | `/api/employees/template` | Download employee import template |
| `GET` | `/api/employees/export` | Export employees |
| `POST` | `/api/employees/add` | Add employee |
| `PATCH` | `/api/employees/[id]` | Update employee |
| `DELETE` | `/api/employees/[id]` | Delete employee |

### Exports And Reports

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/reports/download` | General reports download |
| `GET` | `/api/reports/training-ops/download` | Training operations Excel workbook |
| `GET` | `/api/reports/training-ops/pdf` | Training operations PDF |
| `GET` | `/api/export/pdf` | PDF export by report type |
| `GET` | `/api/export/consolidated` | Consolidated Excel export |
| `GET` | `/api/export/comprehensive-report` | Comprehensive report export |
| `GET` | `/api/export/batch-attendance` | Batch attendance export |
| `GET` | `/api/export/batch-assessment` | Batch assessment export |
| `GET` | `/api/export/batch-feedback` | Batch feedback export |
| `GET` | `/api/export/toppers` | Top performers/topper export |
| `GET` | `/api/leaderboard/[quizId]/download` | Quiz leaderboard download |
| `GET` | `/api/leaderboard/cumulative/download` | Cumulative leaderboard download |

### Training Operations And Files

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/cron/training-governance` | Cron endpoint for training governance automation |
| `GET` | `/api/training/evidence` | Secure evidence file retrieval from storage |

## 6. Core Backend Concepts

### Supabase

The app uses Supabase for:

- User authentication.
- User profiles and roles.
- Quiz, question, attempt, score, badge, leaderboard, training, attendance, feedback, and notification data.
- Admin/service operations through the service role key.
- Storage for training/project evidence files.

Supabase helpers live in:

- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/proxy.ts`

### RBAC

Role-based access is centralized in `lib/rbac.ts`.

Supported roles include:

- `admin`
- `manager`
- `training_coordinator`
- `trainer`
- `employee`

Important helpers:

- `requireManager()`
- `requireTrainingStaff()`
- `requireAdmin()`
- `requireEmployee()`
- `requireManagerForApi()`
- `requireTrainingStaffForApi()`

Pages and APIs redirect or return `401/403` when role checks fail.

### Server Actions

Business mutations mostly live in server actions:

- `lib/actions/auth.ts`
- `lib/actions/employee.ts`
- `lib/actions/manager.ts`
- `lib/actions/quiz.ts`
- `lib/actions/training.ts`

Use route handlers for public API-style work, file uploads/downloads, exports, cron, and AI endpoints. Use server actions for form submissions and authenticated app mutations.

## 7. AI Architecture

Shared AI code is in `lib/ai.ts`.

Provider behavior:

1. If `OPENAI_API_KEY` exists, use OpenAI Chat Completions.
2. Otherwise, if `GOOGLE_GEMINI_API_KEY` exists, use Gemini 1.5 Flash.
3. If neither exists, AI endpoints return configuration errors or fallback behavior where implemented.

Default OpenAI model:

```text
gpt-4o-mini
```

Default Gemini model endpoint:

```text
gemini-1.5-flash:generateContent
```

Main helper functions:

- `callAI(messages, options)` - provider selection wrapper.
- `callOpenAI(messages, options)` - OpenAI call.
- `callGemini(prompt, options)` - Gemini call.
- `stripCodeFences(raw)` - removes markdown fences from AI JSON responses.
- `buildCompactAssessmentContext(data)` - compresses assessment rows for lower token usage.

AI features:

- Topic-based quiz generation.
- Content-based quiz generation.
- Manager dashboard insight.
- Employee learning recommendation.
- Assessment chat and analysis.

## 8. Environment Variables

Create `.env.local` from `.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key for browser/server client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin/service Supabase operations |
| `NEXT_PUBLIC_APP_URL` | Recommended | Base app URL |
| `CRON_SECRET` | Recommended | Protect scheduled governance jobs |
| `OPENAI_API_KEY` | Optional | Primary AI provider |
| `GOOGLE_GEMINI_API_KEY` | Optional | AI fallback provider |
| `RESEND_API_KEY` | Optional/feature-dependent | Email sending |
| `EMAIL_FROM` | Optional/feature-dependent | Sender identity for Resend emails |
| `NODE_ENV` | Standard | Runtime environment |

## 9. NPM Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local Next.js dev server |
| `npm run build` | Production build and TypeScript validation |
| `npm run start` | Start production server after build |
| `npm run lint` | Run ESLint |
| `npm run test:smoke` | Run Playwright smoke test over public/auth routes and manager redirect |
| `npm run fixtures:tms` | Generate TMS upload fixtures |

## 10. Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

Health check:

```text
GET /api/health
```

## 11. Database Setup

Database migrations are stored in `scripts/*.sql`.

Run SQL scripts in order in the Supabase SQL editor for a fresh setup. The later scripts add training operations features such as attendance late reasons, notification delivery statuses, and import/audit support.

The generated type file is:

```text
lib/types/database.ts
```

Update it when Supabase schema changes.

## 12. Testing And Verification

Recommended checks before pushing:

```bash
npm run lint
npm audit --audit-level=moderate
npm run build
npm run test:smoke
```

The smoke test checks:

- Landing page loads.
- Login page loads.
- Signup page loads.
- Reset password page loads.
- `/manager` redirects unauthenticated users to login.
- No real browser console errors.
- No real failed requests, while ignoring harmless Next dev aborted prefetch/static requests.

## 13. Deployment Notes

The app is Vercel-compatible.

Before deployment:

- Configure all Supabase environment variables.
- Configure at least one AI provider key if AI features should work.
- Configure Resend variables if email reminders and alerts should work.
- Run all Supabase migrations.
- Ensure `NEXT_PUBLIC_APP_URL` points to the production URL.
- Configure a scheduler or Vercel Cron to hit `/api/cron/training-governance` if automated governance reminders are needed.

## 14. Recent Maintenance Notes

Recent updates included:

- Next.js upgraded to `16.2.6`.
- React and React DOM upgraded to `19.2.6`.
- Supabase packages upgraded within current compatible ranges.
- Tailwind/PostCSS tooling upgraded.
- Moderate npm audit vulnerabilities cleared.
- Manager dashboard changed from presentation copy to actionable operational metrics.
- Smoke test made more reliable for Next dev mode on Windows.
- Dead legacy AI provider functions removed from content question generation after consolidation through `lib/ai.ts`.

