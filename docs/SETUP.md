# Setup Guide

> Get SkillTest_AI running locally in under 10 minutes.

---

## Prerequisites

| Tool | Minimum Version | Why |
|------|----------------|-----|
| Node.js | 20.9+ | Next.js runtime |
| npm | 9+ | Package manager |
| Git | any | Clone the repo |
| Supabase account | - | Database + Auth |
| AI provider key (one of) | - | Quiz generation |
| Email provider (optional) | - | Completion emails |

---

## Step 1 - Clone & Install

```bash
git clone https://github.com/itslaks/SkillTest_AI.git
cd SkillTest_AI
npm install
```

---

## Step 2 - Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) -> **New project**
2. Note down:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **Anon/public key** (under Settings -> API)
   - **Service role key** (under Settings -> API - keep secret!)

---

## Step 3 - Configure Environment Variables

Copy the template:

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
# -- Supabase (required) ------------------------------------------
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# -- App URL (required for emails) -------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_ALERT_EMAIL=skilltestai01@gmail.com
ADMIN_LOGIN_EMAIL=skilltestai01@gmail.com

# -- AI Provider - pick ONE --------------------------------------
OPENAI_API_KEY=sk-...
# GROQ_API_KEY=gsk_...
# GOOGLE_GEMINI_API_KEY=...

# -- Email - pick ONE (optional) ---------------------------------
# Option A: SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=SkillTest_AI <you@gmail.com>

# Option B: Resend
# RESEND_API_KEY=re_...
# RESEND_FROM=SkillTest_AI <noreply@yourdomain.com>

# -- Optional ----------------------------------------------------
CRON_SECRET=your-random-secret          # Required for /api/cron
SEED_ADMIN_EMAIL=skilltestai01@gmail.com
SEED_TRAINER_EMAIL=trainer@skilltest.ai
SEED_ADMIN_PASSWORD=changeme123!        # For seed_admin.js
SEED_TRAINER_PASSWORD=changeme123!
```

---

## Step 4 - Run Database Migrations

Open the **Supabase SQL Editor** and run each file in `database/migrations/` in order:

```
001_create_profiles.sql
002_create_quizzes.sql
...
050_proctoring_validation_program.sql
```

> Run them one by one, in numeric order. Do not skip any.

### Create the Proctoring Storage Bucket

In Supabase -> **Storage** -> New bucket:
- Name: `quiz-proctoring-evidence`
- Public: **No** (must be private)

---

## Step 5 - Seed Initial Users (Optional)

```bash
node database/seeds/seed_admin.js
```

This creates a default admin and trainer account using the passwords from `.env.local`.

---

## Step 6 - Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Step 7 - First Login

| Role | Default email | Password |
|------|--------------|---------|
| Admin | admin@skilltest.ai | `SEED_ADMIN_PASSWORD` from `.env.local` |
| Trainer | trainer@skilltest.ai | `SEED_TRAINER_PASSWORD` from `.env.local` |

> Change these passwords immediately in a real deployment.

---

## Production Deployment (Vercel)

1. Push code to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Add all env vars in Vercel -> Settings -> Environment Variables
4. Add your Vercel domain to Supabase -> Auth -> Redirect URLs
5. Set `NEXT_PUBLIC_APP_URL` to your production URL
6. Deploy from `main` branch

### Production Checklist

- [ ] All 50 migrations applied
- [ ] `quiz-proctoring-evidence` bucket is **private**
- [ ] Real Supabase keys configured (not local)
- [ ] AI provider key set
- [ ] SMTP or Resend configured
- [ ] `CRON_SECRET` set
- [ ] Seed credentials changed

---

### Production Auth And Email Requirements

- Set `NEXT_PUBLIC_APP_URL` to the stable production URL, not localhost or a Vercel preview URL.
- Set `ADMIN_ALERT_EMAIL=skilltestai01@gmail.com`.
- Configure SMTP or Resend in production; console-only email fallback is development-only.
- In Supabase Auth, turn Confirm Email ON.
- Set Supabase Auth Site URL to the same value as `NEXT_PUBLIC_APP_URL`.
- Add these Supabase Auth Redirect URLs:
  - `https://your-production-domain.com/auth/callback`
  - `https://your-production-domain.com/auth/update-password`
- Verify the Supabase email provider/SMTP settings can send signup verification and reset-password emails.

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `Supabase is not configured` | Missing env vars | Check `.env.local` has real values |
| Employee can't see quiz | Quiz not active or not assigned | Set `status = active` in Supabase, check assignment |
| Camera shows black screen | Permission granted but no stream | Refresh page; browser will auto-start stream |
| AI generation unavailable | No AI key | Set `OPENAI_API_KEY` or `GROQ_API_KEY` |
| Emails not sending | No SMTP/Resend config | Add email env vars |
| Cron returns 401 | Wrong bearer token | Send `Authorization: Bearer <CRON_SECRET>` |
| Smoke test fails | Playwright browser missing | `npx playwright install chromium` |
