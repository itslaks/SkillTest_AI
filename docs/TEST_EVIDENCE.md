# Test Evidence

## Automated Commands

Run before release:

```bash
npm run typecheck
npm run lint -- --quiet
npm run test:unit
npm run build
npm run brd:upload-benchmark
npm run brd:dashboard-benchmark
```

## Acceptance Checklist

| # | Acceptance criterion | Evidence |
|---:|---|---|
| 1 | Coordinator creates, updates, completes, and closes batch | `createTrainingBatch`, `updateTrainingBatchDetails`, `updateTrainingBatchStatus`; lifecycle transition guard |
| 2 | Coordinator uploads candidate Excel | `BatchCandidateImporter`, chunked `/api/training/batch-candidate-import` |
| 3 | Trainer only accesses assigned batches | `canTrainerAccessBatch`, trainer checks in attendance and assessment APIs |
| 4 | Trainer uploads attendance manually | `updateAttendanceStatus`, `ManualAttendanceCard` |
| 5 | Trainer uploads attendance using Excel | `AttendanceImporter`, `/api/training/attendance-import` |
| 6 | Attendance cutoff alert email is sent | `attendance_cutoff` sweep + `sendMandatoryBrdEmail` |
| 7 | 3-day absence alert email is sent | `absence_streak` sweep + configurable `absence_alert_days` |
| 8 | Assessment Excel upload maps scores | `/api/assessment-import`, `assessment_results` |
| 9 | Duplicate/invalid uploads rejected with error report | upload fingerprint checks, row-level errors, downloadable issue files |
| 10 | Feedback email triggered and logged | `createFeedbackWindow`, `brd_email_notification_logs` |
| 11 | Dashboard shows near real-time metrics | operations/report dashboards query live training tables |
| 12 | Reports export in Excel and PDF | `app/api/export/*` |
| 13 | Topper list uses configurable weights | `training_system_settings`, `lib/topper.ts` |
| 14 | Changes auditable | upload logs, attendance versions, notification dispatch, batch audit, admin audit |
| 15 | 20,000-row upload benchmark passes | `npm run brd:upload-benchmark` |
| 16 | Dashboard benchmark under 5 seconds | `npm run brd:dashboard-benchmark` |
| 17 | Health/readiness endpoints return status | `/api/health`, `/api/ready` |

## Evidence From This Pass

- Added `tests/brd-compliance.test.ts` to verify BRD hardening hooks exist.
- Added XLSX benchmark scripts for candidate, attendance, and assessment uploads.
- Added dashboard benchmark script for candidate counts, attendance rate, assessment clearance, trainer performance, and batch comparisons.
- Added mandatory email delivery audit and retry support.

## Remaining Manual Validation

- Run an actual provider test email in staging with real SMTP or Resend credentials using `/api/admin/email-test`.
- Run `/api/health` and `/api/ready` after deployment and confirm external monitor checks.
