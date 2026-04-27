# SkillTest — Maverick TMS

> **Enterprise Training Management & Assessment Platform**
> Built by Hexaware Technologies | Powered by Next.js 16 + Supabase

---

## 🚀 Overview

**SkillTest (Maverick TMS)** is a full-stack enterprise-grade Training Management System designed to handle end-to-end employee skill assessment, training operations, AI-powered insights, and multi-role governance — all in one platform.

Built to handle **1,000+ concurrent users** with optimized server-side rendering, RLS-secured Supabase queries, and connection pooling.

---

## 👥 Three-Tier Role System

| Role | Access Level | Login |
|------|-------------|-------|
| **Admin** | Full platform control — users, roles, approvals, governance | `admin@hexaware.com` |
| **Trainer** | Quizzes, batches, sessions, student performance | Self-register (admin approval required) |
| **Student/Employee** | Assigned quizzes, badges, progress, leaderboard | Self-register (instant access) |

### RBAC Enforcement
- **Admin** → redirected to `/manager/admin` on login
- **Trainer** → redirected to `/manager` (trainer view, limited nav)
- **Student** → redirected to `/employee`
- Every route guarded server-side via `requireRole()`, `requireTrainingStaff()`, `requireAdmin()`

---

## ✨ Key Features

### 🔐 Authentication & Access Control
- **Student sign-up**: Instant account creation → direct login
- **Trainer sign-up**: Account created → `pending_approval` status → admin must approve before login works
- **Admin approval workflow**: Pending trainer sign-ups shown in Admin Console with one-click Approve/Reject
- **Forgot Password**: Full reset flow via Supabase email link
- **Email verification**: Required for all new accounts

### 🎓 Student (Employee) Portal
- View and attempt assigned quizzes
- Real-time readiness meter (AI-powered)
- Badges, streaks, and leaderboard
- Training hub — batch sessions, attendance, feedback
- Knowledge decay tracking

### 👨‍🏫 Trainer Portal
- Create and manage quizzes (manual + AI-generated questions)
- Training operations — batches, sessions, attendance
- Student performance analytics
- Batch DNA fingerprint & trainer impact score

### 🔑 Admin Console
- **Pending Trainer Sign-Ups** — approve or reject new trainer accounts
- Role management — promote/demote any user
- TMS governance controls — attendance thresholds, feedback windows, topper criteria
- Admin audit log — all role and governance changes tracked

### 📊 Intelligence Layer (AI Features)
- Cognitive Load Detector
- Emotional State Inference
- AI question generation from uploaded content
- Assessment result import & analysis
- Trainer Impact Score
- Readiness prediction

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router, Turbopack) |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (email/password + magic link) |
| Styling | Tailwind CSS + Vanilla CSS custom properties |
| UI Components | shadcn/ui (Radix UI primitives) |
| Validation | Zod (server-side schema enforcement) |
| AI | Google Gemini / Groq APIs |
| Deployment | Vercel |

---

## 🗄️ Database Migrations

Run these in order in the Supabase SQL Editor:

```
scripts/001_create_profiles.sql
scripts/002_create_quizzes.sql
...
scripts/024_complete_brd_tms_controls.sql
scripts/025_trainer_approval.sql  ← NEW: trainer approval workflow
```

> **Important**: Run `025_trainer_approval.sql` to enable the trainer approval system. This adds `approval_status` and `rejection_reason` columns to the `profiles` table.

---

## ⚙️ Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=your_vercel_url
GEMINI_API_KEY=your_gemini_key        # optional for AI features
GROQ_API_KEY=your_groq_key            # optional fallback
```

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

---

## 🔑 Default Credentials

| Role | Email | Password |
|------|-------|---------|
| Admin | `admin@hexaware.com` | `Zxcv,0987` |
| Sample Trainer | `trainer@hexaware.com` | `Asdf,1234` |

> Students self-register at `/auth/sign-up` → select **Student** → instant access.
> Trainers self-register → select **Trainer** → wait for admin approval.

---

## 📁 Project Structure

```
app/
├── auth/              # Login, Sign-up, Reset Password, Pending Approval
├── employee/          # Student portal (quizzes, badges, training)
├── manager/           # Trainer/Manager portal
│   └── admin/         # Admin console (approvals, roles, governance)
├── api/               # API routes (AI, exports, imports)
components/
├── manager/           # Sidebar, header, quiz editor, employee importer
├── employee/          # Quiz components, readiness meter
├── insights/          # AI dashboard components
lib/
├── actions/           # Server actions (auth, quiz, manager, training)
├── rbac.ts            # Role-based access control
├── security/          # Zod validation schemas
├── supabase/          # Client setup (server + client)
└── types/             # TypeScript types
scripts/               # Supabase SQL migrations (001–025)
```

---

## 🔒 Security

- All user inputs validated with **Zod schemas** before processing
- **Row-Level Security (RLS)** enforced at the database layer
- Admin operations use **service role client** (bypasses RLS securely server-side)
- No admin role available via self-registration
- Trainer accounts blocked from logging in until admin-approved

---

## 📄 License

Internal use — Hexaware Technologies Capstone Project
