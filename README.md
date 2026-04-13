# 🎯 SkillTest — Gamified Employee Assessment Platform

A **web-based, highly interactive and gamified employee assessment platform** built with Next.js 16, Supabase, and AI-powered question generation.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3fcf8e?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss)

---

## ✨ Features

### 👔 Manager Portal (`/manager`)
- **Dashboard** — Overview of quizzes, attempts, average scores, active employees
- **Quiz Creation** — Create quizzes with topic, difficulty, time limit, question count, passing score, and feedback form URL
- **Difficulty Distribution** — Automatic 50%/10% split (50% at chosen difficulty, 10% each from others)
- **AI Question Generation** — Hybrid approach: OpenAI → Google Gemini → template fallback
- **Quiz Editor** — Inline editing of questions with correct-answer toggling
- **Employee Management** — Excel/CSV upload for bulk employee import with domain auto-categorization
- **Leaderboard Export** — Download quiz leaderboards as Excel files
- **Reports & Analytics** — Per-quiz performance, pass rates, domain distribution, engagement metrics
- **Settings** — Profile management

### 👩‍💻 Employee Portal (`/employee`)
- **Dashboard** — Points, streak, quizzes taken, average score, available quizzes, badges
- **Quiz Taking** — Interactive MCQ interface with:
  - ⏱ Countdown timer (red pulse when < 60s)
  - 📊 Progress bar
  - 🔥 Streak counter with animations
  - ✅ Instant feedback (correct/incorrect highlighting + explanation)
  - 🚀 Auto-submit on timer expiry
- **Results** — Score display (pass/fail), stats grid, leaderboard ranking, feedback form link
- **Global Leaderboard** — Podium for top 3, full ranking by total points
- **Badge Collection** — Earned and locked badges with visual distinction

### 🔐 Authentication
- Email/password sign-up with role selection (manager/employee)
- Magic link sign-in
- Employee ID registration
- Supabase Auth with RLS (Row Level Security)

### 🛡 Security
- IP-based rate limiting (tiered: auth / public / authenticated)
- Zod input validation on all server actions (max 397 chars, injection prevention)
- Secure environment variable handling with runtime validation
- Security headers (X-Content-Type-Options, X-Frame-Options, CSP-adjacent)
- Whitelisted error codes on error pages (no raw user input displayed)

---

## 🏗 Tech Stack

| Layer | Technology |
| ----- | ---------- |
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **UI** | Tailwind CSS 4, Radix UI primitives, shadcn-style components |
| **Icons** | Lucide React |
| **Database** | Supabase (PostgreSQL + RLS) |
| **Auth** | Supabase Auth (password + magic link) |
| **Validation** | Zod |
| **Excel** | SheetJS (xlsx) |
| **AI** | OpenAI GPT-4o-mini / Google Gemini 1.5 Flash (optional) |

---

## 📂 Project Structure

```
app/
├── auth/               # Login, sign-up, callback, error pages
├── employee/           # Employee dashboard, quizzes, leaderboard, badges
├── manager/            # Manager dashboard, quizzes, employees, reports, settings
├── api/                # API routes (AI generation, leaderboard download)
├── layout.tsx          # Root layout
└── page.tsx            # Landing page

components/
├── landing/            # Marketing/landing page sections
├── manager/            # Manager-specific components
└── ui/                 # Reusable UI primitives (shadcn-style)

lib/
├── actions/            # Server actions (auth, quiz, employee, manager)
├── security/           # Rate limiting, validation schemas, env helpers
├── supabase/           # Supabase client/server/proxy setup
├── types/              # TypeScript type definitions
└── utils.ts            # Utility functions

scripts/                # SQL migration scripts (001–008)
```

---

## 🚀 Getting Started

> **Full instructions:** see [EXECUTE.md](./EXECUTE.md)

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Copy and fill environment variables
cp .env.example .env.local

# 3. Run SQL scripts in Supabase SQL Editor (scripts/001–008)

# 4. Start development server
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 📊 Database Schema

| Table | Description |
| ----- | ----------- |
| `profiles` | User accounts with role, domain, employee_id |
| `quizzes` | Quiz definitions (topic, difficulty, time limit, passing score) |
| `questions` | MCQ questions with JSONB options `[{text, isCorrect}]` |
| `quiz_attempts` | User quiz attempts with answers, score, time, points |
| `badges` | Achievement badges with criteria and point values |
| `user_badges` | Junction table for earned badges |
| `user_stats` | Aggregated user statistics (points, streak, avg score) |
| `employee_imports` | Import operation logs |

**Difficulty levels:** `easy` · `medium` · `hard` · `advanced` · `hardcore`

---

## 🤖 AI Question Generation

The platform supports a **hybrid approach** for dynamic MCQ generation:

1. **OpenAI** (GPT-4o-mini) — Primary, if `OPENAI_API_KEY` is set
2. **Google Gemini** (1.5 Flash) — Fallback, if `GOOGLE_GEMINI_API_KEY` is set
3. **Template Engine** — Final fallback, generates parameterized questions from built-in templates

Questions follow the **50%/10% difficulty distribution rule**:
- 50% of questions at the quiz's selected difficulty
- 10% each from the other four difficulty levels

---

## 📋 Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Your app URL (`http://localhost:3000`) |
| `OPENAI_API_KEY` | ❌ | OpenAI API key for AI question generation |
| `GOOGLE_GEMINI_API_KEY` | ❌ | Google Gemini API key (fallback) |

---

## 📜 License

This project is private. All rights reserved.
