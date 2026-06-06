# SkillTest_AI: Mavericks Execution Platform Architecture

The application keeps UI and backend responsibilities separated by folder:

- `app` and `components`: frontend pages, layouts, and reusable UI components.
- `app/api`: thin Next.js route adapters only.
- `lib/backend/controllers`: request/response orchestration for backend endpoints.
- `lib/backend/services`: business logic, report generation, calculations, and workflow rules.
- `lib/backend/repositories`: database queries and persistence logic.
- `lib/backend/database`: Supabase client factories and database connection helpers.
- `lib/backend/entities`: backend entity/type definitions.
- `lib/types`: generated/shared database types kept for compatibility with existing imports.
- `lib/actions`: server actions for authenticated form workflows and app mutations.
- `lib/insights.ts`: shared behavioral analysis, readiness, retention, and impact calculations.
- `lib/ai.ts`: shared OpenAI, Groq, and Gemini provider selection.
- `lib/email.ts`: SMTP, Resend, and development email fallback.
- `lib/proctoring.ts`: proctoring risk weights, severity levels, and auto-submit thresholds.
- `lib/proctoring-server.ts`: server-side proctoring sessions, active-attempt validation, event recording, summaries, and private evidence upload.
- `lib/domain-options.ts`: canonical signup/assignment domain options.
- `lib/avatar-options.ts`: built-in Three.js 3D avatar preset IDs and helpers.
- `components/avatar/`: reusable Three.js avatar renderer, preset picker, and profile avatar view.

New backend work should follow this flow:

`route.ts -> controller -> service -> repository -> database`

Routes should not contain direct database queries or large business rules. If an endpoint needs data, place the query in a repository. If it needs calculations, exports, validations, or workflow decisions, place them in a service.

## Current Practical Exceptions

Some older and fast-moving modules still use server actions or route handlers directly:

| Module | Reason |
| --- | --- |
| `lib/actions/manager.ts` | Form-driven manager/admin mutations such as employee import, assignment, certificate rules |
| `lib/actions/profile.ts` | Authenticated profile dashboard reads |
| `app/api/manager-chatbot/route.ts` | Deterministic command chatbot stats and compact DB context for AI fallback |
| `app/api/proctoring/events/route.ts` | Live proctoring events endpoint kept in-route while the proctoring helper module absorbs session, risk, and evidence logic |

When changing these files, keep business rules small and extracted into shared helpers where possible.

## Certificate Architecture

```text
admin form -> updateCertificateRule() -> certificate_rules
completed attempt -> database trigger -> certificates
old attempts -> 031_backfill_old_certificates.sql -> certificates
certificate page -> /certificates/[id]
```

Admin-controlled certificate fields include enabled status, minimum score, certificate name, title, message, template image, accent color, and notes.

## Chatbot Architecture

The manager chatbot follows this order:

1. Load scoped quizzes, completed attempts, profiles, badges, certificates, certificate rules, and attendance.
2. Try deterministic handlers for exact stats such as employee quiz score, quiz average, weak areas, and certificate eligibility.
3. Parse natural-language quiz creation commands such as `Create quiz on LLM, difficulty medium and assign it to Ram` and create structured quizzes with generated questions.
4. If no deterministic handler or command matches, send compact context to AI.
5. AI must answer only from supplied context and keep responses short.
6. The client renders only polished admin-facing answers and hides internal scope, provider, answer-mode, and fallback labels.

This avoids fake scores while keeping broad natural-language coverage.

## AI Proctoring Architecture

```text
manager quiz form -> quizzes.proctoring_required
employee pre-check -> startQuizAttempt() -> proctoring_sessions
browser signal -> /api/proctoring/events -> recordProctoringEvent()
evidence frame -> private Supabase storage -> quiz_proctoring_evidence
flagged attempt -> /manager/integrity -> review_status / review_notes
```

Proctoring is intentionally opt-in per quiz. Existing and new quizzes default to non-proctored unless an admin/manager enables `Enable AI Proctoring`.

Security boundaries:

- Employee quiz payloads omit correct-answer flags before submission.
- Employees can create/read their own session metadata but cannot read normalized evidence.
- Evidence files are stored in the private `quiz-proctoring-evidence` bucket.
- Staff evidence previews use short-lived signed URLs.
- `/api/proctoring/events` validates authenticated user, attempt ownership, active session, and in-progress attempt state before writing events.

## Training Operations Architecture

Batch creation is kept intentionally compact in the manager operations page:

```text
manager form -> createTrainingBatch() -> training_batches
             -> batch_learners
             -> batch_trainers
             -> quizzes.batch_id
```

The form collects only the required setup fields, one lead trainer, selected learners, and optional linked assessments. The server action returns a specific error if learner enrollment, trainer assignment, or assessment linking fails, so admins do not lose failures behind a successful batch insert.
