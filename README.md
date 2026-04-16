# SkillTest

**Gamified Employee Assessment Platform**

> A production-ready, scalable employee assessment platform for 1000+ concurrent users — AI-powered quiz generation, manager-controlled assignments, gamification, real-time analytics, and a polished professional UI.

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

---

## Table of Contents

- [Features](#features)
- [UI & Design System](#ui--design-system)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Database Schema](#database-schema)
- [Quiz Assignment Flow](#quiz-assignment-flow)
- [AI Question Generation](#ai-question-generation)
- [Security & Scalability](#security--scalability)
- [Gamification System](#gamification-system)
- [Environment Variables](#environment-variables)
- [NPM Scripts](#npm-scripts)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

### Manager Portal — `/manager`

| Feature | Description |
|:--------|:------------|
| **Dashboard** | Real-time overview with colour-coded stat cards (blue/green/purple/orange) |
| **Quiz Creation** | Topic, difficulty, time limit, passing score, feedback URL |
| **AI Question Generation** | GPT-4o-mini -> Gemini 1.5 Flash -> Template engine fallback |
| **Quiz Editor** | Full inline editing — add/remove/reorder questions |
| **Quiz Toggle** | Activate / deactivate quizzes with one click |
| **Employee Management** | All employees with colour-coded stats, domain, activity |
| **Excel Import** | Bulk import employees via Excel/CSV, auto-categorised by domain |
| **Quiz Import** | Import questions from Excel with template download |
| **Quiz Assignment** | Assign quizzes to specific employees |
| **Leaderboard** | Per-quiz and cumulative rankings with points, score, time |
| **Reports** | Full Excel report — Summary, Quiz Performance, All Results, Employee Stats |
| **AI Analytics** | AI-powered insights from uploaded assessment data |
| **Settings** | Profile management |

### Employee Portal — `/employee`

| Feature | Description |
|:--------|:------------|
| **Dashboard** | Points, streak, quizzes done, average score, badges |
| **Live Stats in Nav** | Points and streak visible in the top nav bar at all times |
| **Assigned Quizzes** | Only manager-assigned quizzes are visible (zero by default) |
| **Quiz Player** | Timer, progress bar, streak counter, instant answer feedback |
| **Leaderboard** | Gold-amber podium for top 3, full ranking with streak pills |
| **Badges** | Earned (purple gradient) and locked (dashed border) badge grid |

#### Quiz Player Experience

```
Countdown timer     — red pulse animation when < 60s remaining
Progress bar        — questions answered / total
Streak counter      — consecutive correct answers
Instant feedback    — correct/incorrect highlighting + explanation
Auto-submit         — submits automatically when timer expires
Randomised order    — shuffled questions on every attempt
```

### Authentication

| Feature | Description |
|:--------|:------------|
| Email/Password Sign-Up | Employee-only self-registration |
| Password Sign-In | Secure password-based authentication |
| Server-Side Role Enforcement | Role always set to `employee` on sign-up — cannot be bypassed |
| Supabase Auth + RLS | Row Level Security on every table |
| Protected Routes | Middleware-based session validation |
| Auto-Redirect | Employees -> `/employee`, Managers -> `/manager` after login |

---

## UI & Design System

> **Redesigned April 2026** — professional blue-indigo colour system for daily non-technical users.

### Colour Palette

| Token | Colour | Usage |
|:------|:-------|:------|
| `--primary` | Blue `oklch(0.45 0.18 255)` | Buttons, links, active states |
| `--sidebar` | Deep Navy `oklch(0.18 0.04 255)` | Manager sidebar |
| `--background` | Soft Blue-White | Page backgrounds |
| `--destructive` | Red | Delete actions, errors |
| Stat cards | Blue / Green / Amber / Purple / Orange | One colour per metric type |

### Manager Portal Layout

- Deep navy collapsible sidebar — blue active indicators, dot marker, role label under logo
- White top header — backdrop blur, search bar, notification bell with red dot, avatar with role label and dropdown
- Colour-coded stat cards — blue (quizzes), green (attempts), purple (scores), orange (employees)
- Blue-to-indigo hero welcome banner with **Create Quiz** + **AI Tools** CTA buttons

### Employee Portal Layout

- Top nav bar — live **Points** and **Streak** pills always visible alongside nav links
- Blue gradient welcome banner with direct **Take a Quiz** CTA button
- Quiz cards colour-coded by status — yellow border (in-progress), green border (completed), score badge on completed cards
- Leaderboard — gold-amber podium card for top 3, blue "You" highlight pill, coloured points/streak pills per row
- Badges — earned shown with purple-indigo gradient cards, locked with dashed border + fade effect

### Accessibility

- `focus-visible` outlines on all interactive elements
- WCAG AA contrast ratios throughout
- Tailwind v4 CSS linter warnings suppressed via `.vscode/settings.json`

---

## Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| Framework | Next.js 16 (App Router + Turbopack) | Server components, streaming, server actions |
| Language | TypeScript 5 | Full type safety |
| Styling | Tailwind CSS 4 + tw-animate-css | Utility-first CSS + animations |
| Components | Radix UI + shadcn-style primitives | 50+ accessible UI components |
| Typography | Instrument Sans, Instrument Serif, JetBrains Mono | Google Fonts via next/font |
| Icons | Lucide React | Consistent SVG icons |
| Database | Supabase (PostgreSQL + RLS) | Managed Postgres with row-level security |
| Auth | Supabase Auth | Password-based auth, session management |
| Validation | Zod | Runtime schema validation on all inputs |
| Charts | Recharts | Data visualisation in reports |
| Excel | SheetJS (xlsx) | Import employees/questions, export reports |
| AI | OpenAI GPT-4o-mini / Google Gemini 1.5 Flash | AI-powered question generation & analytics |
| 3D | Three.js + @react-three/fiber | Landing page 3D animations |
| Analytics | Vercel Analytics | Production usage tracking |
| State | React 19 (useTransition, server actions) | Client state management |
| Package Manager | pnpm | Fast, disk-efficient |

---

## Project Structure

```
app/
  auth/          login, sign-up, callback, error
  employee/      layout (top nav + live streak/points), dashboard,
                 quizzes, leaderboard, badges
  manager/       layout (navy sidebar + white header + role guard),
                 dashboard, quizzes, employees, leaderboard,
                 analytics, reports, settings
  api/           generate-questions, generate-from-content,
                 extract-content, leaderboard, reports/download,
                 assessment-import, ai-chat, health

components/
  landing/       16 marketing page sections
  manager/       sidebar, header, quiz-editor, quiz-importer,
                 quiz-toggle-active, quiz-delete-button,
                 quiz-assignment-manager, employee-importer,
                 assessment-analyzer, content-question-generator,
                 profile-form
  ui/            50+ shadcn-style primitives

lib/
  actions/       server actions (auth, quiz, employee, manager)
  supabase/      server + client + admin clients
  types/         TypeScript types and DB schema
  utils.ts       Utility functions

scripts/         SQL migration scripts 001-012
.vscode/         settings.json — suppresses Tailwind v4 CSS linter warnings
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A [Supabase](https://supabase.com) project

### 1. Clone

```bash
git clone https://github.com/itslaks/SkillTest_AI.git
cd SkillTest_AI
pnpm install
```

### 2. Environment Variables — `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

OPENAI_API_KEY=your_openai_key      # optional but recommended
GEMINI_API_KEY=your_gemini_key      # optional fallback

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Setup

Run these SQL scripts **in order** in your Supabase SQL editor:

```
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
```

### 4. Create a Manager Account

```bash
node scripts/seed_admin.js
```

### 5. Start Development

```bash
pnpm dev
```

Open http://localhost:3000

---

## Database Schema

```
profiles           role, employee_id, department, domain
quizzes            title, topic, difficulty, time_limit, passing_score
questions          MCQ options linked to quizzes
quiz_attempts      score, answers, time_taken, points_earned
quiz_assignments   manager-to-employee quiz links
user_stats         total_points, streak, tests_completed
user_badges        earned badge records
badges             name, description, points, criteria
assessment_imports AI import history
```

---

## Quiz Assignment Flow

```
Manager creates quiz
       |
Manager assigns quiz to employee(s) via Employees page
       |
Employee logs in — sees only their assigned quizzes
       |
Employee completes quiz — points, badges, streak updated automatically
       |
Manager views results in Leaderboard / Reports
```

---

## AI Question Generation

Three-tier fallback system:

```
1. OpenAI GPT-4o-mini       Primary (fastest, best quality)
        |
        v (if unavailable or quota exceeded)
2. Google Gemini 1.5 Flash  Secondary fallback
        |
        v (if unavailable)
3. Template Engine           Always available — no API key needed
```

**Generation modes:**

- **Topic-based** — generate questions from a subject/topic name
- **Content-based** — upload PDF/DOCX or paste text, AI extracts questions
- **Excel import** — bulk import pre-written questions from `.xlsx`

---

## Security & Scalability

| Concern | Implementation |
|:--------|:--------------|
| Authentication | Supabase Auth with JWT tokens |
| Authorisation | Row Level Security (RLS) on every table |
| Role Enforcement | Server-side role check — cannot be bypassed via client |
| Input Validation | Zod schemas on all server actions and API routes |
| Rate Limiting | Vercel Edge middleware |
| XSS Prevention | React's built-in escaping + sanitised inputs |
| SQL Injection | Parameterised queries via Supabase client |
| Secrets | Environment variables only — never exposed to client |
| Admin Operations | Service role key used server-side only for leaderboard aggregation |

---

## Gamification System

| Element | How It Works |
|:--------|:------------|
| Points | Earned per correct answer — visible live in the employee nav bar |
| Streak | Days in a row with at least one quiz attempt |
| Badges | Auto-awarded by database triggers on milestones |
| Leaderboard | Ranked by total points — gold podium display for top 3 |
| Progress | Dashboard shows cumulative stats across all attempts |

---

## Environment Variables

| Variable | Required | Description |
|:---------|:---------|:------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server-only) |
| `OPENAI_API_KEY` | Optional | OpenAI key for primary AI generation |
| `GEMINI_API_KEY` | Optional | Google Gemini key for fallback AI |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL of your deployment |

---

## NPM Scripts

```bash
pnpm dev      # Start dev server with Turbopack
pnpm build    # Production build
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

---

## Troubleshooting

**Employees see no quizzes**
Quizzes must be explicitly assigned via the Employees page in the Manager portal.

**AI question generation fails**
Check that `OPENAI_API_KEY` or `GEMINI_API_KEY` is set. The template engine is the last resort fallback.

**Leaderboard shows no data**
Run `scripts/010_fix_leaderboard_rls.sql` in the Supabase SQL editor.

**VS Code CSS warnings** (`@apply`, `@theme`, `@custom-variant`)
These are valid Tailwind v4 syntax — not errors. The `.vscode/settings.json` in this repo already suppresses them.

**Manager cannot see employee attempts**
Run `scripts/011_fix_manager_rls.sql` to fix RLS policies.

---

## License

MIT — free to use, modify, and distribute.

---

Built with Next.js, Supabase, and Tailwind CSS v4
