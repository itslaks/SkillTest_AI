# Architecture

SkillTest_AI is a **Next.js 16 App Router** application backed by **Supabase PostgreSQL**. This document explains every layer — from browser to database — so any developer can navigate the codebase immediately.

---

## Conceptual Layers

```
┌─────────────────────────────────────────────────────────┐
│  🖥️  FRONTEND  (browser)                                │
│  app/**  ·  components/**  ·  hooks/**  ·  styles/**   │
├─────────────────────────────────────────────────────────┤
│  ⚙️  BACKEND  (Node.js / Vercel Edge)                   │
│  app/api/**  ·  lib/actions/**  ·  lib/backend/**       │
├─────────────────────────────────────────────────────────┤
│  🗄️  DATABASE  (Supabase PostgreSQL)                    │
│  database/migrations/**  ·  RLS policies  ·  Triggers  │
└─────────────────────────────────────────────────────────┘
```

---

## Folder Map

```
SkillTest_AI/
│
├── 📂 app/                        ← Next.js App Router
│   ├── 📂 api/                    ← REST API route handlers
│   │   ├── ai-chat/               ← AI coaching chat
│   │   ├── ai-insight/            ← Manager insights
│   │   ├── ai-recommend/          ← Learner recommendations
│   │   ├── ai-status/             ← AI provider health
│   │   ├── assessment-import/     ← Score import endpoint
│   │   ├── certificates/          ← Certificate generation
│   │   ├── cron/training-governance/ ← Scheduled governance
│   │   ├── employees/             ← Employee data API
│   │   ├── export/                ← Excel/PDF export endpoints
│   │   ├── leaderboard/           ← Leaderboard data
│   │   ├── manager-chatbot/       ← Command chatbot
│   │   ├── proctoring/events/     ← Live proctoring event sink
│   │   └── training/              ← Training operations API
│   │
│   ├── 📂 auth/                   ← Login, sign-up, reset, callback
│   ├── 📂 employee/               ← Employee workspace pages
│   │   ├── badges/
│   │   ├── leaderboard/
│   │   ├── quizzes/[quizId]/      ← Quiz player + results
│   │   ├── training/
│   │   └── profile/
│   │
│   ├── 📂 manager/                ← Manager / Admin workspace
│   │   ├── admin/                 ← Admin console
│   │   ├── analytics/             ← AI-powered dashboards
│   │   ├── compliance/            ← BRD evidence pack
│   │   ├── employees/             ← Employee management
│   │   ├── integrity/             ← Proctoring review center
│   │   ├── operations/            ← Training batch management
│   │   ├── quizzes/               ← Quiz CRUD
│   │   ├── reports/               ← Report downloads
│   │   └── settings/
│   │
│   ├── 📂 certificates/           ← Public certificate viewer
│   ├── 📂 profiles/               ← Public profile pages
│   └── 📂 demo/                   ← Demo / preview routes
│
├── 📂 components/                 ← Reusable React components
│   ├── 📂 ui/                     ← Base shadcn/Radix components
│   ├── 📂 manager/                ← Manager-specific widgets
│   ├── 📂 employee/               ← Employee-specific widgets
│   ├── 📂 avatar/                 ← 3D avatar renderer & picker
│   ├── 📂 certificates/           ← Certificate card & viewer
│   ├── 📂 insights/               ← Readiness meter, orb
│   ├── 📂 landing/                ← Public landing page sections
│   ├── 📂 navigation/             ← Nav bars and sidebars
│   ├── 📂 profile/                ← Profile dashboard widgets
│   └── 📂 quiz/                   ← Quiz display components
│
├── 📂 lib/                        ← Business logic & utilities
│   ├── 📂 actions/                ← Next.js server actions
│   │   ├── auth.ts                ← Sign-in, sign-up, reset
│   │   ├── employee.ts            ← Quiz attempt, submission
│   │   ├── manager.ts             ← Employee import, assignment
│   │   ├── profile.ts             ← Profile reads/updates
│   │   ├── quiz.ts                ← Quiz CRUD actions
│   │   └── training.ts            ← Batch/session actions
│   │
│   ├── 📂 backend/                ← Layered backend services
│   │   ├── 📂 controllers/        ← Route orchestration
│   │   ├── 📂 services/           ← Business rules, calculations
│   │   ├── 📂 repositories/       ← Database query functions
│   │   ├── 📂 database/           ← Supabase client factory
│   │   └── 📂 entities/           ← Backend type definitions
│   │
│   ├── 📂 security/               ← Zod validation, rate limiting
│   ├── 📂 supabase/               ← Client/server Supabase helpers
│   ├── 📂 types/                  ← Shared TypeScript types
│   ├── ai.ts                      ← OpenAI / Groq / Gemini selector
│   ├── email.ts                   ← SMTP / Resend email builder
│   ├── proctoring.ts              ← Risk weights, severity levels
│   ├── proctoring-server.ts       ← Server-side session & evidence
│   ├── proctoring-vision.ts       ← Browser TensorFlow vision
│   ├── rbac.ts                    ← Role access checks
│   ├── insights.ts                ← Readiness / retention logic
│   └── utils.ts                   ← Shared helpers
│
├── 📂 database/                   ← All database files
│   ├── 📂 migrations/             ← 001–040 SQL schema files
│   ├── 📂 seeds/                  ← Seed data & fixture generators
│   └── 📂 fixes/                  ← One-off applied patches
│
├── 📂 docs/                       ← Developer documentation
│   ├── ARCHITECTURE.md            ← This file
│   ├── SETUP.md                   ← Local setup guide
│   ├── TECHNICAL_OVERVIEW.md      ← Full technical reference
│   ├── PROCTORING.md              ← AI proctoring deep-dive
│   └── PRESENTATION.md            ← Presentation notes
│
├── 📂 hooks/                      ← Custom React hooks
├── 📂 public/                     ← Static assets & import templates
│   └── 📂 templates/              ← CSV/XLSX import templates
├── 📂 styles/                     ← Global CSS
└── README.md                      ← Project overview
```

---

## Backend Request Flow

Every request follows this path:

```mermaid
flowchart LR
    Browser -->|HTTP request| Route
    Route["app/api/route.ts\n🔵 Thin adapter"]
    Route --> Controller["lib/backend/controllers/\n🟢 Orchestration"]
    Controller --> Service["lib/backend/services/\n🟡 Business logic"]
    Service --> Repo["lib/backend/repositories/\n🟠 DB queries"]
    Repo --> DB["Supabase PostgreSQL\n🔴 Data"]
    DB --> Repo --> Service --> Controller --> Route --> Browser
```

**Rule:** Routes contain no business logic. Services contain no direct DB calls. Keep each layer thin.

### Current Exceptions (fast-moving modules)

| Module | Why it skips layers |
|--------|-------------------|
| `lib/actions/manager.ts` | Form-driven mutations with Next.js server actions |
| `lib/actions/profile.ts` | Authenticated profile reads |
| `app/api/manager-chatbot/route.ts` | Compact DB context for AI fallback |
| `app/api/proctoring/events/route.ts` | Latency-sensitive live event sink |

---

## Authentication & RBAC Flow

```mermaid
flowchart TD
    Request["Incoming request"] --> MW["middleware.ts\nSupabase session check"]
    MW -->|No session| Login["Redirect → /auth/login"]
    MW -->|Has session| RBAC["lib/rbac.ts\nrequireRole() check"]
    RBAC -->|Wrong role| Denied["403 / redirect"]
    RBAC -->|Correct role| Page["Render page / execute action"]

    style MW fill:#3b82f6,color:#fff
    style RBAC fill:#8b5cf6,color:#fff
    style Login fill:#ef4444,color:#fff
    style Denied fill:#ef4444,color:#fff
    style Page fill:#22c55e,color:#fff
```

### Roles

| 🔴 Admin | 🟠 Manager | 🟡 Training Coordinator | 🟢 Trainer | 🔵 Employee |
|----------|-----------|------------------------|-----------|------------|
| Full platform | Manager workspace | Training operations | Assigned batches | Learner workspace |

---

## Quiz Attempt Flow

```mermaid
flowchart TD
    A["Employee selects quiz"] --> B{"Proctoring\nrequired?"}

    B -->|No| C["startQuizAttempt()\nCreate attempt row"]
    B -->|Yes| D["Pre-check screen\nCamera · Mic · Fullscreen · Consent"]

    D --> E{"All checks\npassed?"}
    E -->|No| D
    E -->|Yes| F["startProctoringMediaStream()\ngetUserMedia()"]
    F --> G["startQuizAttempt()\nCreate proctoring_session row"]

    G --> H["Quiz player renders\n🎥 Vision proctoring starts"]
    C --> H

    H --> I{"Violation\ndetected?"}
    I -->|Yes| J["POST /api/proctoring/events\nRecord + calculate risk"]
    J --> K{"Auto-submit\nthreshold?"}
    K -->|Yes| L["Auto-submit\nattempt = suspicious"]
    K -->|No| H

    H --> M{"Time up or\nlast question?"}
    M -->|Yes| N["submitQuizAttempt()\nScore + badges + cert"]
    N --> O["Email sent\nResult page"]

    style D fill:#f59e0b,color:#000
    style F fill:#3b82f6,color:#fff
    style H fill:#8b5cf6,color:#fff
    style L fill:#ef4444,color:#fff
    style O fill:#22c55e,color:#fff
```

---

## AI Proctoring Architecture

```mermaid
flowchart LR
    subgraph Browser["🖥️ Browser"]
        Vision["lib/proctoring-vision.ts\nTensorFlow.js\nFace · Gaze · Objects"]
        Player["quiz-player.tsx\nRecords violations\nShows banners/modals"]
    end

    subgraph Server["⚙️ Server"]
        API["POST /api/proctoring/events\nValidates session + ownership"]
        ProcServer["lib/proctoring-server.ts\nRisk score · Evidence upload"]
        Risk["lib/proctoring.ts\nRisk weights · Auto-submit rules"]
    end

    subgraph Storage["🗄️ Supabase"]
        Sessions["proctoring_sessions"]
        Events["proctoring_events"]
        Evidence["quiz-proctoring-evidence\n(private bucket)"]
        Attempts["quiz_attempts\nstatus = suspicious"]
    end

    Vision -->|violation + frame| Player
    Player -->|POST event| API
    API --> ProcServer
    ProcServer --> Risk
    ProcServer --> Sessions
    ProcServer --> Events
    ProcServer --> Evidence
    Risk -->|threshold reached| Attempts

    style Vision fill:#8b5cf6,color:#fff
    style API fill:#3b82f6,color:#fff
    style Evidence fill:#ef4444,color:#fff
    style Attempts fill:#f59e0b,color:#000
```

**Violation cooldowns** (prevent alert flooding):

| Violation | Cooldown |
|-----------|---------|
| `multiple_faces` | 4 s |
| `no_face` | 5 s |
| `gaze_down` / `gaze_away` | 10 s |
| `phone_detected` / `electronic_device` | 8 s |
| Default | 12 s |

---

## Email Flow

```mermaid
flowchart LR
    Trigger["Trigger:\nAttempt completed\nor staff approves"] --> Builder["lib/email.ts\nbuildQuizCompletedEmail()"]
    Builder --> Provider{"Email\nprovider"}
    Provider -->|SMTP_HOST set| SMTP["Nodemailer\nSMTP"]
    Provider -->|RESEND_API_KEY set| Resend["Resend API"]
    Provider -->|Neither| Console["console.log\n(dev only)"]

    style Builder fill:#3b82f6,color:#fff
    style SMTP fill:#22c55e,color:#fff
    style Resend fill:#22c55e,color:#fff
    style Console fill:#6b7280,color:#fff
```

---

## Certificate Architecture

```mermaid
flowchart TD
    Form["Quiz create/edit form\nEnable certificate toggle"] --> Rules["certificate_rules table\nmin_score · title · message · template"]
    Rules --> Trigger["PostgreSQL trigger\n(on attempt completed)"]
    Trigger --> Cert["certificates table\ncert_number · issued_at"]

    SuspAttempt["suspicious attempt"] --> Review["/manager/integrity\nStaff approve/reject"]
    Review -->|approved| Complete["attempt → completed"]
    Complete --> Trigger

    Cert --> Page["/certificates/[id]\nPublic certificate viewer"]
    Cert --> Email["Completion email\nCertificate download link"]

    style Form fill:#3b82f6,color:#fff
    style Trigger fill:#f59e0b,color:#000
    style Review fill:#8b5cf6,color:#fff
    style Page fill:#22c55e,color:#fff
```

---

## Data Model (Key Tables)

```
profiles          → id, email, full_name, role, domain
quizzes           → id, title, topic, difficulty, passing_score, proctoring_required
quiz_questions    → id, quiz_id, question_text, options[], correct_option
quiz_assignments  → id, quiz_id, user_id, assigned_at
quiz_attempts     → id, quiz_id, user_id, score, status, proctoring_data
certificates      → id, quiz_id, user_id, cert_number, issued_at
certificate_rules → id, quiz_id, min_score, title, message, template_url
user_badges       → id, user_id, badge_id, earned_at
training_batches  → id, name, domain, start_date, lead_trainer_id
batch_learners    → id, batch_id, user_id
proctoring_sessions → id, attempt_id, started_at, risk_score
proctoring_events → id, session_id, type, label, occurred_at, evidence_url
```
