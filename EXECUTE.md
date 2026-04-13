# 🚀 How to Run — SkillTest

Step-by-step instructions to get the platform running locally.

---

## Prerequisites

| Tool       | Version  | Install                                    |
| ---------- | -------- | ------------------------------------------ |
| **Node.js** | ≥ 18.x  | https://nodejs.org                         |
| **npm**     | ≥ 9.x   | Comes with Node.js                         |
| **Git**     | any      | https://git-scm.com                        |
| **Supabase account** | — | https://supabase.com (free tier works) |

---

## 1 · Clone the repository

```bash
git clone <your-repo-url>
cd app
```

---

## 2 · Install dependencies

```bash
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required because some packages have peer-dependency conflicts with React 19.

---

## 3 · Set up Supabase

1. Go to [supabase.com](https://supabase.com) → create a new project.
2. In your project dashboard go to **Settings → API** and copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key (keep secret!)

---

## 4 · Configure environment variables

```bash
# Copy the example file
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional — for AI question generation
# OPENAI_API_KEY=sk-...
# GOOGLE_GEMINI_API_KEY=...
```

---

## 5 · Run the database migrations

Go to your Supabase project → **SQL Editor** and execute these files **in order**:

```
scripts/001_create_profiles.sql
scripts/002_create_quizzes.sql
scripts/003_create_questions.sql
scripts/004_create_attempts.sql
scripts/005_create_gamification.sql
scripts/006_create_triggers.sql
scripts/007_seed_badges.sql
scripts/008_add_passing_score.sql
```

> Each script is idempotent (`IF NOT EXISTS`), so re-running is safe.

---

## 6 · Start the development server

```bash
npm run dev
```

The app will be available at **http://localhost:3000**.

---

## 7 · Build for production

```bash
npm run build
npm run start
```

---

## 8 · Create your first accounts

1. Open **http://localhost:3000/auth/sign-up**
2. Register a **Manager** account (select role = "manager")
3. Register an **Employee** account (select role = "employee", add an Employee ID)
4. Confirm emails via the Supabase dashboard → **Authentication → Users** (or check your inbox if email is configured)

---

## Quick reference — NPM scripts

| Command          | Description                       |
| ---------------- | --------------------------------- |
| `npm run dev`    | Start development server (Turbopack) |
| `npm run build`  | Create production build            |
| `npm run start`  | Serve the production build         |
| `npm run lint`   | Run ESLint                         |

---

## Troubleshooting

| Problem | Solution |
| ------- | -------- |
| `Module not found: @supabase/supabase-js` | Run `npm install @supabase/supabase-js --legacy-peer-deps` |
| `useSearchParams() should be wrapped in Suspense` | Already fixed — run `npm run build` again |
| Build fails with env errors | Make sure `.env.local` exists with all required variables |
| `EACCES` or `ExecutionPolicy` error on Windows | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in PowerShell |
| Supabase RLS errors (`new row violates policy`) | Run all SQL scripts in order; check the user's role in the `profiles` table |
