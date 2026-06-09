# AI Proctoring System

SkillTest_AI includes a full browser-based AI proctoring system powered by TensorFlow.js. This document covers how it works end-to-end, how to configure it, and how staff review flagged attempts.

---

## How It Works — Overview

```
Employee starts quiz
       │
       ▼
Pre-check screen ──────────────────────────────────────────────────────────┐
  ✅ Camera permission (getUserMedia)                                       │
  ✅ Microphone permission (optional)                                       │
  ✅ Face visible (TensorFlow face detection)                               │
  ✅ Fullscreen mode                                                        │
  ✅ Consent checkbox                                                       │
       │                                                                    │
       ▼ (all checks pass)                                               if fail
Quiz player loads                                                       show error
  📹 Camera stream active
  🧠 TensorFlow models load in background
  🔍 Frame inspection every 1.5 seconds
       │
       ├── multiple_faces detected → 🔴 Red banner + modal + violation recorded
       ├── no_face for 4+ seconds → ⚠️ Warning modal + violation recorded
       ├── gaze_down / gaze_away → ⚠️ Warning modal + violation recorded
       ├── phone / laptop / book → ⚠️ Warning modal + violation recorded
       ├── tab hidden / blur / fullscreen exit → violation recorded
       └── keyboard shortcuts / copy / paste → violation recorded
       │
       ▼
Risk engine evaluates each event
  violationCount ≥ 3  OR  riskScore ≥ critical threshold
       │
       ▼
Auto-submit → attempt.status = "suspicious"
       │
       ▼
Staff review in /manager/integrity
  ├── Approve → attempt becomes "completed", score/cert released, email sent
  ├── Reject → attempt stays flagged
  ├── Require retest → employee is notified to retake
  └── Escalate → escalated for further investigation
```

---

## Enabling Proctoring

In the quiz create/edit form:

1. Toggle **Enable AI Proctoring** on
2. Optionally toggle **Require Microphone**
3. Save the quiz

The employee will see the full pre-check screen the next time they open that quiz.

---

## Vision Detection — `lib/proctoring-vision.ts`

Uses three TensorFlow.js models loaded lazily in the browser:

| Model | What it detects |
|-------|----------------|
| `MediaPipeFaceDetector` | Face count, face position, face size |
| `MediaPipeFaceMesh` | Gaze direction (yaw, nose-to-lip ratio) |
| `COCO-SSD` | Objects: phone, laptop, book |

### Violation Types & Cooldowns

| Type | What triggers it | Cooldown |
|------|----------------|---------|
| `multiple_faces` | 2+ faces in frame | **4 s** |
| `no_face` | No face for 4 s | **5 s** |
| `gaze_down` | Nose-to-lip ratio > 0.7 for 6+ frames | **10 s** |
| `gaze_away` | Yaw > 30° for 6+ frames | **10 s** |
| `phone_detected` | COCO-SSD "cell phone" with confidence > 0.55 | **8 s** |
| `electronic_device` | COCO-SSD "laptop" with confidence > 0.55 | **8 s** |
| `book_detected` | COCO-SSD "book" with confidence > 0.50 | **10 s** |

### Fail-Open Design

If TensorFlow models fail to load (slow network, unsupported browser), the proctoring system **falls back gracefully** — the pre-check passes with a "camera preview is live" message and the quiz proceeds. This prevents employees from being blocked by model download failures.

---

## Browser Integrity Checks

Beyond vision, the quiz player monitors:

| Event | How detected | Violation type |
|-------|-------------|---------------|
| Tab switch | `document.visibilitychange` | `tab-hidden` |
| Window blur | `window.blur` | `window-blur` |
| Fullscreen exit | `document.fullscreenchange` | `fullscreen-exit` |
| Back navigation | `window.popstate` | `back-navigation` |
| Copy / Paste / Cut | Clipboard events | `copy-attempt` / `paste-attempt` |
| Keyboard shortcuts | `Ctrl/Cmd/Alt + any key`, `F11`, `PrintScreen` | `blocked-shortcut` |
| Right-click | `contextmenu` | `context-menu` |
| Camera stream lost | Track `ended` event | `camera-lost` |
| DevTools open | `outerWidth - innerWidth > 180` | `devtools-open` |
| Long inactivity | No mouse/key/click for 45 s | `blocked-shortcut` |
| Network offline | `window.offline` | `network-offline` |

---

## Risk Engine — `lib/proctoring.ts`

Each violation type has a **risk weight**. The cumulative risk score is compared against thresholds:

```
Auto-submit triggers when:
  violationCount ≥ PROCTORING_VIOLATION_LIMIT   (default: 3)
  OR
  riskScore ≥ PROCTORING_CRITICAL_RISK_SCORE    (check lib/proctoring.ts)
```

High-risk violation types (e.g. `phone_detected`, `multiple_faces`) carry more weight than low-risk types (e.g. `window-blur`).

---

## Evidence Storage

When a violation is recorded, the quiz player captures a JPEG frame from the camera and sends it with the event payload to `POST /api/proctoring/events`.

Evidence is stored in Supabase Storage:
- Bucket: `quiz-proctoring-evidence` (**private** — never accessible by employees)
- Staff review generates short-lived signed URLs (expires in minutes)
- Employees' result pages never fetch evidence

---

## Staff Review — `/manager/integrity`

The Integrity Center shows:
- All **suspicious** attempts with risk scores, violation counts, and evidence thumbnails
- Live violation timeline per attempt
- Candidate profile with historical integrity data

### Review Actions

| Button | What happens |
|--------|-------------|
| **Approve** | Attempt → `completed`; score, certificate, and badges released; email sent to employee |
| **Dismiss** | Violations dismissed; attempt → `completed` without penalty |
| **Reject** | Attempt remains flagged; employee cannot retake |
| **Require Retest** | Attempt flagged; employee receives a new quiz assignment |
| **Escalate** | Flagged for HR or senior review |

---

## Camera Black Screen Fix

When an employee takes a **second proctored quiz** in the same browser session, the browser's permission system already shows camera as "granted". The app detects this and automatically calls `getUserMedia()` to attach the stream — no button click required. The video preview loads immediately.

---

## Security Boundaries

- Employee quiz payloads **strip correct-answer flags** before sending to the browser
- Answer keys are only fetched **after** the attempt is submitted/completed
- Proctoring evidence is in a **private bucket** — signed URLs expire quickly
- `/api/proctoring/events` validates: authenticated user → attempt ownership → active session → in-progress status before writing any event
- Notification and email failures are isolated from event recording — violations are always logged even if emails fail
