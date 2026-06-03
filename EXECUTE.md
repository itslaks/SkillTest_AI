# How To Run SkillTest_AI

This is the operational runbook for local setup, Supabase setup, SMTP setup, and deployment.

## Prerequisites

| Tool | Version / Notes |
| --- | --- |
| Node.js | 20.9+ recommended |
| npm | Included with Node |
| Git | Required for source control |
| Supabase | Project URL, anon key, service role key |
| Vercel | Recommended production host |
| AI key | OpenAI preferred, Groq/Gemini fallback optional |
| Email | SMTP or Resend optional, required for mail delivery |

## Local Setup

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

If PowerShell cannot find npm:

```powershell
$env:PATH='C:\Program Files\nodejs;'+$env:PATH
npm run dev
```

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000

OPENAI_API_KEY=your-openai-key
GROQ_API_KEY=your-groq-key
GROQ_MODEL=llama-3.3-70b-versatile
GOOGLE_GEMINI_API_KEY=your-gemini-key

EMAIL_FROM="SkillTest_AI <your-email@gmail.com>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_SECURE=false

CRON_SECRET=replace_with_a_long_random_secret
```

## SMTP Setup

For Gmail:

1. Enable 2-step verification in Google Account.
2. Go to Google Account -> Security -> App passwords.
3. Create an app password for mail.
4. Use that app password as `SMTP_PASS`.
5. Add the SMTP variables locally and in Vercel.
6. Redeploy after changing Vercel env vars.

Do not use your normal Gmail password.

## Supabase Migrations

Run SQL scripts in `scripts/` in numeric order for a fresh project.

Current important latest scripts:

| Script | Purpose |
| --- | --- |
| `029_sync_quiz_status_visibility.sql` | Syncs quiz active/status visibility |
| `030_certificates_badge_expansion.sql` | Adds certificates and 260+ styled badges |
| `031_backfill_old_certificates.sql` | Adds certificate template fields and backfills old eligible certificates |

If you already ran `030`, configure certificate rules in `/manager/admin`, then run `031`.

## First Admin / Trainer

Use the seed script after environment variables are configured:

```bash
SEED_ADMIN_PASSWORD="strong-admin-password" SEED_TRAINER_PASSWORD="strong-trainer-password" node scripts/seed_admin.js
```

Trainer signups are pending until an admin approves them in `/manager/admin`.

## Feature Checks

After setup, test:

| Feature | Route |
| --- | --- |
| Signup with employee ID/domain | `/auth/sign-up` |
| Admin console and certificate rules | `/manager/admin` |
| Employee domain assignment | `/manager/employees` or `/manager/quizzes/[id]` |
| Profile search | `/profiles` |
| Avatar settings | `/profile/settings` |
| Certificate view | `/certificates/[id]` |
| Chatbot | Floating AI Command button in manager pages |

## Production / Vercel

1. Push to GitHub `main`.
2. In Vercel, connect/import the GitHub repo.
3. Add the same environment variables in Vercel Project Settings.
4. Confirm Supabase auth redirect URLs include the Vercel domain.
5. Redeploy from latest `main`.

## Verification Commands

```bash
npm run lint
npm run build
npm run test:smoke
```
