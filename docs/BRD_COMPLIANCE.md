# BRD Compliance

## Status

The Maverick Execution Platform / TMS implements the BRD training lifecycle requirements with the June 2026 compliance hardening pass.

| Requirement | Status | Evidence |
|---|---:|---|
| Batch lifecycle: planned, running, completed, closed | Implemented | `lib/actions/training.ts`, `training_batch_change_audit` |
| Candidate Excel onboarding and batch assignment | Implemented | `components/manager/batch-candidate-importer.tsx`, `app/api/training/batch-candidate-import/route.ts` |
| Trainer-assigned batch access | Implemented | `lib/training-access.ts`, `app/api/training/attendance-import/route.ts` |
| Daily attendance manual and Excel upload | Implemented | `components/manager/manual-attendance-card.tsx`, `components/manager/attendance-importer.tsx` |
| Attendance cutoff email | Implemented | `runTrainingAutomationSweep`, `sendMandatoryBrdEmail` |
| Consecutive absence email | Implemented | `runTrainingAutomationSweep`, `sendMandatoryBrdEmail` |
| Successful attendance upload email | Implemented | `app/api/training/attendance-import/route.ts` |
| Assessment score Excel upload | Implemented | `components/manager/assessment-score-importer.tsx`, `app/api/assessment-import/route.ts` |
| Successful assessment upload email | Implemented | `app/api/assessment-import/route.ts` |
| Assessment reminder email | Implemented | `runTrainingAutomationSweep` |
| Feedback request email | Implemented | `createFeedbackWindow`, feedback reminder sweep |
| Quiz assignment email | Implemented | `notifyQuizAssigned`, `brd_email_notification_logs.event_type = quiz_assigned` |
| Quiz result AI analysis email | Implemented | `submitQuiz`, `brd_email_notification_logs.event_type = quiz_result_analysis` |
| Training session allocation email | Implemented | `syncTrainingSessionVisibility`, `brd_email_notification_logs.event_type = session_allocated` |
| Feedback collection and reporting | Implemented | `training_feedback`, export routes |
| Dashboard metrics | Implemented | `app/manager/operations/page.tsx`, `app/manager/reports/page.tsx` |
| Excel/PDF reports | Implemented | `app/api/export/*`, `components/manager/tms-batch-downloads.tsx` |
| Topper criteria and topper reports | Implemented | `lib/topper.ts`, `training_system_settings`, topper exports |
| Audit and logging | Implemented | upload logs, attendance versions, notification logs, admin audit, batch change audit |
| 20,000-row Excel validation | Implemented | `npm run brd:upload-benchmark` |
| Dashboard under 5 seconds benchmark | Implemented | `npm run brd:dashboard-benchmark` |
| Health/readiness support | Implemented | `/api/health`, `/api/ready`, `lib/readiness.ts` |

## Mandatory Email

BRD mandatory emails use `lib/brd-notifications.ts`. Every BRD event attempts email delivery and writes `brd_email_notification_logs` with event type, recipient, role, batch, provider, status, error, and timestamps. If SMTP or Resend is missing, the log is marked `failed` with a configuration error. Failed messages can be retried through `/api/cron/retry-brd-email`.

Quiz assignment emails are routed through `lib/quiz-assignment-notifications.ts` for manager UI assignment, AI Command `assign quiz`, and AI Command create-and-assign flows. Each recipient gets one `brd_email_notification_logs` row with `event_type = quiz_assigned`, then the provider result updates the row to `sent` or `failed`.

Quiz result AI analysis emails are routed through `sendMandatoryBrdEmail` after a completed quiz attempt. Employees receive the AI coaching report with weak topics, strong topics, feedback, and suggested practice. Trainers/coordinators tied to the quiz or batch receive a separate coaching brief that names the employee and highlights topics to reinforce. Each recipient gets a `brd_email_notification_logs` row with `event_type = quiz_result_analysis`, and SMTP/Resend failures are retained for retry instead of being silently ignored.

Training session allocation emails are routed through `lib/training-session-sync.ts` for manager Training Ops session creation/update and AI Command session creation/update. Each trainer and learner recipient gets one `brd_email_notification_logs` row with `event_type = session_allocated`, linked back to the Training Ops notification row. SMTP or Resend failures update both the BRD log and the visible Training Ops delivery status. Trainer recipients receive a facilitator brief, while employee recipients receive a learner invitation that asks them to join 10 minutes before the session.

## Value Added Features Beyond BRD

These features increase scope and functionality but are not required for BRD compliance:

- AI quiz generation and content extraction
- AI Command operations copilot, including quiz-result AI insight questions for admins and trainers
- AI proctoring with evidence and review gates
- Certificates, badges, and leaderboards
- Learner recommendations and readiness insights
- SaaS, tenant, SSO, and billing foundation
- Per-quiz topic performance visualization, weak-topic alerts, AI Insights weak-topic chart, and employee/trainer result-analysis emails

## Remaining Risk

99.5% uptime is a production operations target. The application now exposes readiness checks and deployment monitoring guidance, but the SLA must be measured in production using external monitoring.
