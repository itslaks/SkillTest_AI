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

New backend work should follow this flow:

`route.ts -> controller -> service -> repository -> database`

Routes should not contain direct database queries or large business rules. If an endpoint needs data, place the query in a repository. If it needs calculations, exports, validations, or workflow decisions, place them in a service.
