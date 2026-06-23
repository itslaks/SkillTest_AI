# AI Proctoring + Chatbot Quiz Creation Staging Handoff

## 1. Pre-Deployment Checklist

- Environment variables required:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_APP_URL`
- Supabase connection required:
  - Staging Supabase project is reachable from the deployed app.
  - Auth, database, and storage are enabled.
  - Service role key is set only on the server/runtime environment.
- Email provider required:
  - Configure the app-supported provider keys, such as Resend or SMTP variables used by `lib/email.ts`.
  - Verify trainer/admin recipient emails exist in `profiles.email`.
  - Verify outbound email is allowed from staging.
- AI provider key required for AI-generated quiz questions:
  - At least one supported provider key must exist, such as `OPENAI_API_KEY`, `GROQ_API_KEY`, or `GOOGLE_GEMINI_API_KEY`.
  - Without an AI key, chatbot quiz creation should use template-generated questions instead of creating an empty quiz.
- Browser requirements for camera/fullscreen:
  - Current Chrome, Edge, or Firefox desktop browser.
  - HTTPS staging URL, or `localhost` for local testing.
  - Camera and microphone available and not already in use.
  - Fullscreen permission supported by the browser.
  - Pop-up/permission prompts not globally blocked.

## 2. Supabase Migration Checklist

- Exact migration files to run for current deployments:
  - Run every file in `database/migrations/` in numeric order, from `001_create_profiles.sql` through `050_proctoring_validation_program.sql`.
  - The original proctoring rollout is covered by `038_add_normalized_quiz_proctoring.sql`, `039_proctoring_notifications_realtime.sql`, `040_suspicious_attempt_review_gate.sql`, `041_proctoring_server_authorization.sql`, and `042_proctoring_baseline_and_event_metadata.sql`.
  - Do not use the old `scripts/` SQL path; migration SQL now lives under `database/migrations/`.
- SQL verification queries:

```sql
select column_name, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'quizzes'
  and column_name = 'proctoring_required';

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('proctoring_sessions', 'quiz_proctoring_events', 'quiz_proctoring_evidence')
order by table_name;

select id, public
from storage.buckets
where id = 'quiz-proctoring-evidence';

select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('proctoring_sessions', 'quiz_proctoring_events', 'quiz_proctoring_evidence')
order by tablename, policyname;

select schemaname, tablename, policyname
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname ilike '%quiz proctoring%';

select status, proctoring_status, review_status
from quiz_attempts
where status = 'suspicious'
limit 5;
```

- Expected results:
  - `quizzes.proctoring_required` exists, is `NOT NULL`, and defaults to `false`.
  - All three normalized proctoring tables exist.
  - Storage bucket `quiz-proctoring-evidence` exists with `public = false`.
  - Public RLS policies exist for sessions/events/evidence.
  - No employee SELECT policy exists on `quiz_proctoring_evidence`.
  - Staff roles include `trainer`, `training_staff`, `training_coordinator`, `manager`, and `admin` where applicable.
  - `quiz_attempts.status` and `quiz_attempts.proctoring_status` accept `suspicious` for review-gated attempts.
- Rollback notes if migration fails:
  - If the migration fails before table creation, fix the SQL error and rerun the full script.
  - If it fails after partial table creation, the script is intended to be rerunnable because it uses `IF NOT EXISTS` and policy replacement.
  - Do not drop `quiz_attempts`, `quizzes`, `profiles`, or existing training tables.
  - If storage bucket creation fails, create the private bucket manually and rerun the policy section.
  - If legacy cleanup is suspected to affect data unexpectedly, restore `quiz_attempts.proctoring_events` from the latest database backup.

## 3. Seed/Test Data Checklist

- One admin:
  - Approved profile with role `admin`.
  - Valid email for receiving proctoring alerts.
- One trainer:
  - Approved profile with role `trainer`.
  - Valid email for receiving scoped proctoring alerts.
- One employee named Ram:
  - Approved profile with role `employee`.
  - `full_name = 'Ram'`.
  - Valid login credentials.
- One proctored quiz:
  - Active quiz assigned to Ram.
  - `proctoring_required = true`.
  - At least three questions.
- One non-proctored quiz:
  - Active quiz assigned to Ram.
  - `proctoring_required = false`.
  - At least three questions.
- One chatbot-created quiz:
  - Created through manager/admin chatbot.
  - Verify title is structured, for example `LLM Assessment`.
  - Verify questions exist.
  - Verify assignment target exists.

## 4. Staging Test Script

1. Admin enables proctoring:
   - Login as admin or manager.
   - Create or edit a quiz.
   - Turn on `Enable AI Proctoring`.
   - Save.
   - Verify `quizzes.proctoring_required = true`.

2. Employee starts proctored quiz:
   - Login as Ram.
   - Open assigned proctored quiz.
   - Verify pre-check screen appears.
   - Enable camera.
   - Enable microphone.
   - Confirm fullscreen readiness.
   - Accept consent.
   - Start quiz.
   - Verify attempt and proctoring session are created.

3. Camera denied flow:
   - Reset browser camera permission for staging URL.
   - Open proctored quiz.
   - Click `Enable Camera`.
   - Deny permission.
   - Verify start remains disabled and recovery instructions appear.

4. Fullscreen denied flow:
   - Complete camera and microphone checks.
   - Block or cancel fullscreen on launch.
   - Verify quiz does not start and clear error appears.

5. Normal submission flow:
   - Complete pre-checks.
   - Answer all questions without violations.
   - Submit normally.
   - Verify completed attempt, score, and safe result page.

6. Tab switch violation:
   - Start proctored quiz.
   - Switch tabs or background the page.
   - Return to quiz.
   - Verify one `tab-hidden` event exists.

7. Fullscreen exit violation:
   - Start proctored quiz.
   - Exit fullscreen.
   - Verify one `fullscreen-exit` event exists.

8. 3-strike auto-submit:
   - Trigger three valid violations separated enough to bypass duplicate cooldown.
   - Verify API returns auto-submit behavior.
   - Verify attempt is `suspicious`, `auto_submitted = true`, and `proctoring_status = 'suspicious'`.
   - Verify the employee result page shows under-review status without score, certificate, badge, or completion email release.

9. Integrity dashboard review:
   - Login as trainer/admin.
   - Open `/manager/integrity`.
   - Verify suspicious attempt appears.
   - Verify timeline is visible.
   - Verify signed evidence preview appears if evidence exists.
   - Apply approve, reject, retest, and escalate on test attempts.
   - Verify notes and status persist.
   - Verify approve releases score, certificate eligibility, badges, completion email, and employee result access.

10. Email alert verification:
   - Trigger server-side auto-submit.
   - Verify exactly one staff alert email is sent.
   - Verify email contains secure review link.
   - Verify email does not contain base64 image data or public evidence links.
   - Verify missing trainer/admin email does not break submission.

11. Employee evidence access denial:
   - Login as employee.
   - Open result page.
   - Verify no evidence path, signed URL, or image appears.
   - Attempt direct storage URL access if known.
   - Verify access is denied or requires staff signed URL.

12. Chatbot command: `Create quiz on LLM, difficulty medium and assign it to Ram`
   - Login as admin.
   - Submit command in manager chatbot.
   - Verify parsed topic `LLM`, difficulty `medium`, assignee `Ram`.
   - Verify created title is `LLM Assessment` or similar, not the full sentence.
   - Verify questions exist.
   - Verify Ram receives assignment.

13. Chatbot command: `Generate 15 hard SQL questions for the Data Engineering team`
   - Login as admin.
   - Submit command.
   - Verify topic `SQL`, difficulty `hard`, question count `15`, target `Data Engineering`.
   - Verify created title is `SQL Assessment` or similar.
   - Verify 15 questions exist.
   - Verify assignments are created for matching Data Engineering employees.

14. Non-proctored quiz still works:
   - Login as Ram.
   - Open assigned non-proctored quiz.
   - Verify no camera/microphone/fullscreen pre-check blocks start.
   - Submit normally.
   - Verify result page works.

## 5. Pass/Fail Table

| Test case | Expected result | Actual result | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Admin enables proctoring | Toggle persists as `proctoring_required = true` |  |  |  |
| Employee starts proctored quiz | Pre-check passes, attempt and session created |  |  |  |
| Camera denied flow | Start disabled, clear recovery message |  |  |  |
| Fullscreen denied flow | Quiz does not start, clear error |  |  |  |
| Normal submission flow | Attempt completed, result page safe |  |  |  |
| Tab switch violation | One violation event recorded |  |  |  |
| Fullscreen exit violation | One violation event recorded |  |  |  |
| 3-strike auto-submit | Attempt auto-submitted and flagged |  |  |  |
| Integrity dashboard review | Timeline/evidence/status review works |  |  |  |
| Email alert verification | One safe staff email sent |  |  |  |
| Employee evidence denial | Employee cannot view evidence |  |  |  |
| Chatbot LLM command | Structured quiz, questions, Ram assignment |  |  |  |
| Chatbot SQL team command | Structured quiz, 15 questions, team assignment |  |  |  |
| Non-proctored quiz | Starts and submits without pre-check |  |  |  |

## 6. Release Decision Criteria

- Must pass before release:
  - Migration runs successfully.
  - Existing quizzes remain non-proctored by default.
  - Admin can enable/disable proctoring.
  - Proctored quiz requires camera, microphone, consent, and fullscreen.
  - Non-proctored quiz still starts and submits.
  - No correct answers leak before submit.
  - Employee cannot access evidence.
  - 3-strike auto-submit flags attempt.
  - Integrity dashboard can review flagged attempt.
  - Chatbot does not store full natural sentence as title.
  - Chatbot-created quizzes contain questions.

- Can release with warning:
  - AI provider unavailable, if template question fallback is accepted.
  - Email provider unavailable in staging, if submission remains non-blocking and production email config is confirmed before go-live.
  - Evidence preview absent for events where camera frame capture failed, if event timeline still records correctly.

- Must block release:
  - Migration fails or corrupts existing quiz/attempt data.
  - Existing active quizzes become proctored unintentionally.
  - Employee can see evidence paths, signed URLs, or blobs.
  - Correct answers leak before submission.
  - Proctored quiz can start without required checks.
  - Auto-submit corrupts scoring or allows duplicate submissions.
  - Staff cannot access Integrity Center for flagged attempts.
  - Chatbot creates empty quizzes.
  - Chatbot stores raw natural command as quiz title.

## 7. Final Handoff Summary

- Implemented:
  - Normalized proctoring migration with private evidence storage.
  - Realtime notification compatibility and suspicious-attempt review gate migrations.
  - Safe default `proctoring_required = false`.
  - Admin create/edit toggle for AI proctoring.
  - Employee pre-check for camera, microphone, fullscreen, browser support, and consent.
  - Server-side active session and attempt status validation.
  - Evidence references kept out of employee result pages.
  - Integrity dashboard review workflow for suspicious attempts.
  - Employee under-review result state that blocks scores, certificates, badges, and completion emails until approval.
  - Chatbot natural-language quiz intent parsing.
  - Chatbot question generation with AI when configured and template fallback otherwise.

- Safe now:
  - Existing quizzes should not be blocked by proctoring after migration.
  - Admins must explicitly enable proctoring per quiz.
  - Employees cannot read normalized evidence through app routes.
  - Chatbot should create structured quiz titles and non-empty quizzes.

- Still requires live validation:
  - Real camera and microphone browser prompts.
  - Supabase storage evidence upload and signed preview.
  - RLS behavior using real staging users.
  - Email delivery and duplicate-alert behavior.
  - Full 3-strike auto-submit flow with real attempts.

- Admin action before enabling for real employees:
  - Run migrations `038`, `039`, and `040`.
  - Configure Supabase, email, and AI provider keys.
  - Create staging test users and run the full script above.
  - Enable AI Proctoring only on quizzes where camera/fullscreen enforcement is intended.
