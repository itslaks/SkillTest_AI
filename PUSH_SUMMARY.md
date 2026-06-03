# Current Push Summary

Repository: `https://github.com/itslaks/SkillTest_AI`

Branch: `main`

## Latest Feature Areas

| Area | Summary |
| --- | --- |
| Profiles | Searchable profile dashboards, employee IDs, domains, avatars |
| Signup | Employee ID and domain/vertical captured during signup |
| Assignment | Domain search and color-coded filters for quiz assignment |
| Certificates | Admin thresholds, template upload, personalized certificate page, old attempt backfill |
| Badges | 260+ styled badges seeded by migration `030` |
| Email | SMTP/Resend assignment and completion notifications |
| Chatbot | Short deterministic stats for employee quiz analysis, averages, weak areas, certificates |
| AI | OpenAI primary, Groq fallback, Gemini fallback |

## Required Supabase State

| Migration | Required For |
| --- | --- |
| `029_sync_quiz_status_visibility.sql` | Active quiz visibility |
| `030_certificates_badge_expansion.sql` | Certificates and expanded badges |
| `031_backfill_old_certificates.sql` | Certificate template fields and old-attempt certificates |

Run `031` after saving certificate rules in `/manager/admin`.

## Verification

Recent checks used:

```bash
npm run lint
npm run build
npm run test:smoke
```

On Windows, direct Node invocation may be used when `npm` is not on PATH.
