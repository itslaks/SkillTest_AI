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
- `lib/domain-options.ts`: canonical signup/assignment domain options.
- `lib/avatar-options.ts`: built-in default avatar faces.

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
3. If no deterministic handler matches, send compact context to AI.
4. AI must answer only from supplied context and keep responses short.

This avoids fake scores while keeping broad natural-language coverage.
