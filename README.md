# SkillTest_AI: Mavericks Execution Platform

**AI-powered Training Management System** - built for enterprise learning teams who need real operations, governance proof, and contest-ready evidence, not just dashboards.

SkillTest_AI: Mavericks Execution Platform combines intelligent quiz generation, end-to-end training operations, real-time attendance tracking, AI coaching insights, BRD proof, and automated reporting in a single platform designed for non-technical trainers, coordinators, and learners.

## Technical Documentation

For a crisp owner-level explanation of the language, framework, routes, API endpoints, environment variables, scripts, AI providers, and deployment flow, see [docs/TECHNICAL_OVERVIEW.md](docs/TECHNICAL_OVERVIEW.md).

---

## What Makes SkillTest_AI Different

| Capability | Details |
|---|---|
| **AI Quiz Generation** | Generate MCQs from a topic or uploaded content (PDF/DOCX) in a single API call. OpenAI (gpt-4o-mini) preferred, Gemini 1.5 Flash fallback. |
| **AI Coaching Insights** | `/api/ai-insight` — managers get 2-sentence coaching tips on batch health, attendance, trainer performance, and quiz results. Capped at 200 tokens. |
| **AI Learning Recommendations** | `/api/ai-recommend` — employees receive personalised next-step coaching based on their streak, pass rate, and retention risk. 150 tokens per call. |
| **AI Assessment Chat** | Upload an assessment Excel → chat with AI to analyse scores, identify weak areas, and get remediation suggestions. |
| **Training Operations** | Full batch lifecycle: create batch → assign candidates & trainers → schedule sessions → mark attendance → upload scores → evaluate projects → download reports. |
| **Role-Based Access** | Admin / Manager / Training Coordinator / Trainer / Employee — each sees exactly what they need. |
| **Attendance System** | Cut-off enforcement, late-reason audit log, bulk Excel import with row-level validation. |
| **Assessment Import** | Score upload with duplicate detection, passing-score rules, and per-row error reporting. |
| **PDF & Excel Exports** | One-click reports: attendance, assessment, feedback, trainer performance, consolidated TMS. |
| **Feedback System** | Coordinator-controlled feedback windows → employee submission → AI sentiment analysis for managers. |
| **Gamification** | Points, streaks, badges, and live leaderboard for learners. |
| **Notifications** | Email (Resend) + in-app notifications for sessions, reminders, and alerts. |
| **BRD Evidence Pack** | `/manager/compliance` maps BRD requirements to live screens and `/api/reports/training-ops/download` exports a one-click judge workbook. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router (React Server Components) |
| Database & Auth | Supabase (PostgreSQL + Row-Level Security) |
| AI | OpenAI GPT-4o-mini (primary) · Google Gemini 1.5 Flash (fallback) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts (bar, pie/donut, radar) |
| Email | Resend |
| Excel | SheetJS (xlsx) |
| PDF | jsPDF + jspdf-autotable |
| Storage | Supabase Storage (training evidence) |
| Deployment | Vercel |

---

## AI Integration Architecture

All AI calls go through `lib/ai.ts` — a single shared utility that:

- Picks **OpenAI** if `OPENAI_API_KEY` is set, **Gemini** otherwise
- Enforces per-endpoint `max_tokens` caps to keep costs controlled
- Provides `buildCompactAssessmentContext()` — pipe-delimited rows vs verbose JSON (~60% token reduction)
- Provides `stripCodeFences()` for safe JSON parsing from AI responses

### AI Endpoints

| Endpoint | Purpose | Max Tokens |
|---|---|---|
| `POST /api/ai-chat` | Manager assessment chat with history | 600 |
| `POST /api/ai-insight` | Coaching insight (batch/attendance/trainer/quiz) | 200 |
| `POST /api/ai-recommend` | Employee personalised learning recommendation | 150 |
| `POST /api/generate-questions` | AI quiz generation from topic (single call) | 4000 |
| `POST /api/generate-from-content` | AI quiz from uploaded content (single call) | 4000 |

**Token efficiency improvement:** Question generation was previously N separate API calls (one per difficulty). It is now a single batched call, reducing costs by up to 80% for a 5-difficulty quiz.

---

## Roles & Capabilities

### Admin
- Full platform governance
- Manage all users, batches, quizzes, settings
- Trainer approval workflow

### Manager / Training Coordinator
- Create and manage training batches
- Assign candidates and trainers
- Monitor attendance health, session schedule
- AI-powered dashboard insights
- Download PDF and Excel reports
- AI assessment analyser with chat

### Trainer
- Guided daily workflow: mark attendance → upload scores → submit evaluations
- Step-by-step trainer workspace (no technical knowledge required)
- Scoped to assigned batches only

### Employee / Learner
- Personalised AI learning recommendation on dashboard
- Quiz assignments with readiness signals
- Training schedule, attendance history, reminders
- Feedback submission, gamification (points, streak, badges)

---

## Getting Started

### Prerequisites

```bash
# Node.js 20+, npm or pnpm
# Supabase project
# OpenAI API key (or Google Gemini API key)
# Resend account for email
```

### Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key          # Primary AI provider
GOOGLE_GEMINI_API_KEY=your_gemini_key   # Fallback AI provider
RESEND_API_KEY=your_resend_key
```

### Install & Run

```bash
npm install
npm run dev
```

### Database Setup

Run scripts in order from `scripts/` (001 through 028) in your Supabase SQL editor.

---

## Key Pages

| URL | Role | Purpose |
|---|---|---|
| `/manager` | Manager | Dashboard with AI batch health insight, TMS live status |
| `/manager/operations` | Manager/Trainer | Full TMS — batches, sessions, attendance, scores |
| `/manager/analytics` | Manager | AI assessment analyser + chat |
| `/manager/reports` | Manager | Trainer performance + AI coaching tip + exports |
| `/employee` | Learner | Dashboard with personalised AI recommendation |
| `/employee/training` | Learner | Training schedule, attendance, feedback |
| `/employee/quizzes` | Learner | Assigned assessments |

---

## Project Structure

```
app/
  api/
    ai-chat/          # Assessment chat with history
    ai-insight/       # Manager coaching insights (200 tokens)
    ai-recommend/     # Employee learning recommendations (150 tokens)
    generate-questions/   # Topic-based quiz generation (1 API call)
    generate-from-content/ # Content-based quiz generation (1 API call)
    training/         # Attendance import, session management
    export/           # PDF & Excel report generation
  manager/            # All manager/trainer pages
  employee/           # All learner pages
components/
  manager/
    ai-insight-card.tsx   # Reusable AI coaching widget
    trainer-performance-panel.tsx
    feedback-sentiment-chart.tsx
  employee/
    ai-learn-recommend.tsx  # Employee AI coaching widget
lib/
  ai.ts              # Shared AI utility (callAI, buildCompactAssessmentContext)
  actions/           # Server actions (training, quiz, employee)
  supabase/          # DB clients
scripts/             # SQL migrations (001-028)
```

---

## AI Features Demonstration

### 1. Manager Dashboard AI Insight
When you load `/manager`, the dashboard automatically shows:
- **AI Batch Health Insight** — analyses active batches, attendance rate, alerts, and gives one actionable 2-sentence recommendation
- Real-time data from TMS + AI processing in <1 second

### 2. Employee Learning Coach
When a learner loads `/employee`, they see:
- **SkillTest AI — Your Coach** card with personalised recommendation based on their points, streak, completed quizzes, and retention risk
- Example: "Your 7-day streak is strong—keep it going by tackling JavaScript Basics next. With 85% pass rate, you're ready for medium difficulty."

### 3. Trainer Performance AI Coaching
On `/manager/reports`, after the trainer performance chart:
- **AI Coaching Tip** analyses top/bottom performers and suggests concrete improvement actions
- Example: "John Smith leads with 92% attendance and 88% avg scores. Focus on improving Maria's session clarity—her attendance is solid but assessment outcomes lag."

### 4. AI Assessment Chat
On `/manager/analytics`:
- Upload Excel assessment results
- Ask: "Who are the top 5 performers?" or "Which employees need improvement?"
- AI responds with data-driven insights + suggestions

### 5. AI Quiz Generation
On `/manager/quizzes`:
- **Generate from Topic**: Enter "React Hooks" + select difficulty → AI creates 20 questions in 3 seconds
- **Generate from Content**: Upload a PDF/DOCX training manual → AI extracts key concepts and generates targeted questions

All AI responses are capped at specific token limits to keep OpenAI costs predictable.

---

## Non-Technical User Experience

### For Trainers (zero technical knowledge required)
1. Log in → see **Trainer Workspace** with 3-step daily guide:
   - **Step 1**: Mark attendance (before 10 AM cut-off)
   - **Step 2**: Upload assessment scores (Excel template provided)
   - **Step 3**: Submit project evaluations
2. All actions have plain-English labels, example placeholders, and error messages
3. Late attendance submission prompts: "Why are you submitting after 10 AM? (required if uploading after the cut-off time)" — no jargon

### For Learners (gamified, friendly)
1. Dashboard shows: "Welcome back, [Name]" + AI personal coach recommendation
2. Quiz cards say "Refresh due" instead of "Retention pressure"
3. "You are doing well!" instead of "Anti-gaming pattern detected"
4. All technical terms replaced with everyday language

---

## Performance & Scalability

- **Database**: Supabase Postgres with Row-Level Security policies on all tables
- **Auth**: Supabase Auth with role-based redirects
- **Caching**: React Server Components cache quiz/batch data server-side
- **AI calls**: Batched where possible; single quiz generation = 1 API call (not 5)
- **Reports**: PDF/Excel generated server-side, streamed to client
- **Real-time**: Leaderboard uses Supabase real-time subscriptions

---

## Security & Compliance

- All database access via RLS policies
- Service role key used only in server-side code
- Trainer access scoped to assigned batches only
- Attendance cut-off enforcement with audit trail
- Email notifications via Resend (GDPR-compliant)
- No user data sent to AI beyond anonymized stats

---

## Roadmap

- [ ] Multi-language support (i18n)
- [ ] Mobile app (React Native)
- [ ] Video training integration
- [ ] Advanced analytics (predictive failure risk)
- [ ] Slack/Teams notifications
- [ ] Custom branding per organization

---

## License

Private. All rights reserved.

---

## Support

For issues or questions, contact: [Your contact email]

---

**Built with ❤️ for training teams who deserve better tools.**
