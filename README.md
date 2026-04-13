# 🎯 SkillTest — Gamified Employee Assessment Platform

A **web-based, highly interactive and gamified employee assessment platform** built with Next.js 16, Supabase, and AI-powered question generation.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3fcf8e?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)

---

## ✨ Features

### 👔 Manager Portal (`/manager`)
- **Dashboard** — Overview of quizzes, attempts, average scores, active employees
- **Admin Shorthand** — Quick login support: use `admin` or `manager` as email for designated accounts
- **Quiz Creation** — Create quizzes with topic, difficulty, time limit, question count, passing score, and feedback form URL
- **AI Question Generation** — Hybrid approach (OpenAI/Gemini/Template) with **Auto-Approval** for immediate deployment
- **Quiz Editor** — Inline editing of questions with correct-answer toggling
- **Employee Management** — Excel/CSV upload for bulk employee import with domain auto-categorization

### 👩‍💻 Employee Portal (`/employee`)
- **Dashboard** — Points, streak, active assessments, and progress tracking
- **Interactive Quiz Interface** — Gamified MCQ with timer, progress bar, and instant feedback
- **Mandatory Feedback Loop** — Integrated requirement for employees to provide feedback before finalizing assessments
- **Global Leaderboard** — Real-time rankings and badges showcase

### 🔐 Authentication & Security
- **Flexible Login** — Support for shorthand admin IDs and standard email/password
- **RLS Robustness** — Optimized Row-Level Security policies with JWT metadata checks (non-recursive)
- **Validation** — Strict Zod schema enforcement on all inputs

---

## 🏗 Tech Stack

| Layer | Technology |
| ----- | ---------- |
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **Database** | Supabase (PostgreSQL + RLS) |
| **AI** | OpenAI GPT-4o-mini / Google Gemini 1.5 Flash |

---

## 📂 Deployment (Vercel)

The platform is optimized for Vercel deployment:
1. **Link Repo**: Connect your GitHub repository.
2. **Environment Variables**: Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`.
3. **Supabase Config**: Update your **Site URL** and **Redirect URLs** in Supabase Auth settings to match your Vercel domain.

---

## 🚀 Getting Started

> **Full instructions:** see [EXECUTE.md](./EXECUTE.md)

1. **Install**: `npm install --legacy-peer-deps`
2. **Env**: Set up `.env.local`
3. **Database**: Run SQL scripts in `scripts/001–008` (Ensure RLS recursion fixes are applied)
4. **Dev**: `npm run dev`

---

## 📊 Database Schema

| Table | Description |
| ----- | ----------- |
| `profiles` | User accounts with role, domain, and employee metadata |
| `quizzes` | Quiz definitions and parameters |
| `questions` | MCQ questions (supports auto-approved AI generation) |
| `quiz_attempts` | Tracking scores, time-taken, and gamification points |

---

## 🤖 AI Question Generation
Supports OpenAI (Primary), Gemini (Fallback), and Template (Final Fallback). 
**Note:** AI questions are auto-approved by default in the current version for seamless testing and deployment.

---

## 📜 License
This project is private. All rights reserved.
