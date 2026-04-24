# SkillTest AI

🚀 SkillTest AI is a production-focused employee assessment platform built for training teams that want more than basic quiz delivery.

It combines quiz operations, gamification, behavioral intelligence, trainer outcome analytics, and retention tracking in one system. Managers can create and assign assessments, while employees get adaptive quiz experiences with readiness guidance, cooldown prompts, live performance feedback, and leaderboard-based motivation.

## ✨ What Problem This Solves

Traditional quiz tools usually stop at:

- quiz creation
- score calculation
- static reporting

SkillTest AI goes further by turning quizzes into a training intelligence engine.

This project is designed to support a training-management platform where the product should not only measure scores, but also help answer questions like:

- Is a trainee overloaded even before they fail?
- Is a trainee panicking and randomly guessing?
- Is a perfect score actually learning, or just memorization?
- Which topics are weak across an entire batch?
- Which trainer is driving stronger outcomes?
- Which knowledge areas are decaying over time?
- Should a trainee attempt a quiz now, or revise first?

## 🧠 Core AI Intelligence Layer

The following intelligence features are now wired into both backend logic and frontend surfaces.

### 1. Cognitive Load Detector

- Tracks hesitation time per answer.
- Flags cognitive overload when an `easy` question takes more than 15 seconds.
- Influences the next adaptive difficulty target in real time.
- Visible inside the employee quiz flow and manager analytics.

### 2. Emotional State Inference via Answer Patterns

- Detects panic-like behavior using fast wrong-answer streaks.
- Suggests a cooldown/reset prompt mid-quiz.
- Feeds behavioral summaries in the results view and analytics cockpit.

### 3. Batch DNA Fingerprint

- Aggregates topic-level strength and blind-spot patterns across attempts.
- Displays a radar-chart batch profile for trainer review.
- Helps managers plan the next session based on collective weak areas.

### 4. Predictive Readiness Score

- Estimates readiness before a trainee starts a quiz.
- Uses quiz history, streak, topic/domain alignment, and training age.
- Shows a readiness meter with recommendation states:
  - `ready`
  - `focus`
  - `revise`

### 5. Anti-Gaming / Anti-Pattern Detection

- Detects same-topic repeated perfect attempts completed too quickly.
- Flags likely memorization behavior instead of genuine mastery.
- Pushes the quiz flow toward challenge mode and harder follow-up behavior.

### 6. Trainer Impact Score

- Connects outcomes back to the quiz owner / trainer.
- Surfaces topic-level trainer performance signals.
- Helps identify which trainer-topic combinations need intervention.

### 7. Knowledge Decay Tracker

- Tracks time since last assessment on a topic.
- Highlights topics that cross the 2-week retention window.
- Compares baseline vs latest score to surface decay risk.

## 🖥️ Frontend Coverage

These changes are not backend-only. They are visible across the product UI.

### Employee Frontend

#### Dashboard

- Shows readiness-driven next actions.
- Highlights retention-risk topics.
- Surfaces behavioral AI as part of the learning flow.

#### Quiz Listing

- Displays readiness meters per available quiz.
- Shows challenge mode and retention due states.
- Gives revision/attempt guidance before launch.

#### Quiz Player

- Uses a black-and-white high-contrast aesthetic.
- Includes animated 3D-style orb visuals.
- Tracks live cognitive load and panic signals.
- Suggests cooldown moments when stress patterns appear.
- Adjusts the next question batch target difficulty in real time.

#### Results Page

- Shows behavioral AI summary after submission.
- Explains cognitive-load and panic detections.
- Shows next recommended difficulty and retention context.

### Manager Frontend

#### Dashboard

- Shows the updated monochrome design direction.
- Exposes the new AI surfaces from the main manager entry point.

#### Analytics Cockpit

- Shows batch DNA radar chart.
- Shows trainer impact score chart.
- Shows retention / knowledge decay cards.
- Shows anti-gaming watchlist.
- Summarizes panic-mode and overload counts.

## ⚙️ Backend Coverage

The backend is wired so these features are not mock UI states.

### Shared intelligence engine

[`lib/insights.ts`](./lib/insights.ts)

Contains the shared intelligence logic for:

- readiness scoring
- attempt behavior analysis
- batch profiling
- trainer impact scoring
- retention checks
- adaptive difficulty shifting

### Employee actions

[`lib/actions/employee.ts`](./lib/actions/employee.ts)

Handles:

- enriched answer payloads
- post-submit behavioral signal persistence
- readiness calculation before quiz launch
- anti-gaming analysis
- retention mapping for employee quiz lists and dashboards

### Validation and types

[`lib/security/validation.ts`](./lib/security/validation.ts)
[`lib/types/database.ts`](./lib/types/database.ts)

These were extended to support:

- question difficulty per answer
- cognitive-load flags
- panic flags
- adaptive difficulty metadata
- readiness and retention data structures

## 🎨 Design Direction

The app now leans into a cooler black-and-white aesthetic instead of a generic bright dashboard look.

### Design choices

- monochrome palette
- higher contrast cards
- cinematic dark hero sections
- subtle radial background texture
- 3D orb-style animated visual element
- rounded premium card shapes
- calmer, more deliberate motion

Primary styling updates live in:

- [`app/globals.css`](./app/globals.css)
- [`components/insights/monochrome-orb.tsx`](./components/insights/monochrome-orb.tsx)
- [`components/insights/readiness-meter.tsx`](./components/insights/readiness-meter.tsx)

## 🧩 Feature Summary

### Managers can

- create quizzes
- edit and manage questions
- activate/deactivate quizzes
- assign quizzes to employees
- monitor completions
- export reports and leaderboards
- inspect trainer impact
- review batch fingerprinting
- identify panic or overload patterns
- detect memorization anti-patterns
- identify knowledge decay risk

### Employees can

- see assigned quizzes only
- continue in-progress quizzes
- view readiness scores before starting
- take adaptive quizzes
- receive instant answer feedback
- receive cooldown guidance during panic/overload signals
- review behavior-aware results
- view quiz and global leaderboards
- earn points, streaks, and badges

## 🏗️ Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI primitives | Radix UI |
| Auth + DB | Supabase |
| Charts | Recharts |
| 3D visuals | Three.js + React Three Fiber |
| File import | SheetJS / xlsx |
| AI integrations | OpenAI + Gemini fallback |
| Analytics | Vercel Analytics |

## 📁 Important App Areas

### Employee experience

- [`app/employee/page.tsx`](./app/employee/page.tsx)
- [`app/employee/quizzes/page.tsx`](./app/employee/quizzes/page.tsx)
- [`app/employee/quizzes/[quizId]/page.tsx`](./app/employee/quizzes/%5BquizId%5D/page.tsx)
- [`app/employee/quizzes/[quizId]/quiz-player.tsx`](./app/employee/quizzes/%5BquizId%5D/quiz-player.tsx)
- [`app/employee/quizzes/[quizId]/results/page.tsx`](./app/employee/quizzes/%5BquizId%5D/results/page.tsx)

### Manager experience

- [`app/manager/page.tsx`](./app/manager/page.tsx)
- [`app/manager/analytics/page.tsx`](./app/manager/analytics/page.tsx)
- [`components/manager/intelligence-dashboard.tsx`](./components/manager/intelligence-dashboard.tsx)

### Intelligence engine

- [`lib/insights.ts`](./lib/insights.ts)
- [`lib/actions/employee.ts`](./lib/actions/employee.ts)

## 🔐 Authentication

SkillTest uses Supabase Auth.

Supported flows:

- employee sign up
- sign in
- forgot password
- reset/update password
- manager/employee role-based redirects

## 🗄️ Database Setup

Run the SQL scripts in `scripts/` in order through the Supabase SQL editor.

```text
scripts/001_create_profiles.sql
scripts/002_create_quizzes.sql
scripts/003_create_questions.sql
scripts/004_create_attempts.sql
scripts/005_create_gamification.sql
scripts/006_create_triggers.sql
scripts/007_seed_badges.sql
scripts/008_add_passing_score.sql
scripts/009_create_quiz_assignments.sql
scripts/010_fix_leaderboard_rls.sql
scripts/011_fix_manager_rls.sql
scripts/012_create_assessment_imports.sql
scripts/013_fix_rbac_trigger.sql
scripts/014_add_status_to_quizzes.sql
scripts/015_remove_question_approval_system.sql
scripts/016_safe_remove_approval_system.sql
scripts/017_enhanced_user_stats_trigger.sql
scripts/018_add_updated_at_to_questions.sql
scripts/019_more_meaningful_badges.sql
scripts/020_create_training_operations.sql
```

## 🔑 Environment Variables

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

- At least one AI key is needed for AI generation features.
- `SUPABASE_SERVICE_ROLE_KEY` is required for admin-style import/export flows.

## 🧪 Verification

The production hardening pass included:

- ✅ `npx tsc --noEmit --pretty false`
- ✅ `npm run build`

Known note:

- `npm run lint` is currently not runnable because `eslint` is not installed in this repository even though the script exists.

## 🚀 Local Development

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

Run build:

```bash
npm run build
```

Run type-check:

```bash
npx tsc --noEmit --pretty false
```

## 🧭 Useful Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/auth/login` | Login |
| `/auth/sign-up` | Employee sign up |
| `/auth/reset-password` | Request reset link |
| `/auth/update-password` | Set new password |
| `/manager` | Manager dashboard |
| `/manager/operations` | Batch lifecycle, attendance, trainer coordination, reminders |
| `/manager/quizzes` | Quiz creation and management |
| `/manager/analytics` | Behavioral AI analytics cockpit |
| `/manager/employees` | Employee management |
| `/manager/leaderboard` | Rankings and exports |
| `/manager/reports` | Reports and downloads |
| `/employee` | Employee intelligence dashboard |
| `/employee/training` | Batch, sessions, reminders, attendance, feedback |
| `/employee/quizzes` | Assigned quiz deck |
| `/employee/quizzes/[quizId]` | Adaptive quiz player |
| `/employee/quizzes/[quizId]/results` | Behavioral results report |
| `/employee/leaderboard` | Employee leaderboard |
| `/employee/badges` | Badge collection |

## 🛠️ Production Readiness Notes

### Strong areas

- shared intelligence logic instead of duplicated UI math
- server-side readiness computation
- adaptive behavior reflected in frontend
- type-checked intelligence flow
- production build passing
- clear separation of employee vs manager surfaces

### Recommended next steps for an even stronger production rollout

- add real automated tests for readiness and behavioral scoring
- install and enforce ESLint in CI
- add database migrations specifically for long-term analytics persistence if you want historical trainer benchmarking beyond attempt payload analysis
- add scheduled jobs if retention checks should proactively create assignments instead of only surfacing UI signals

## 📜 License

MIT
