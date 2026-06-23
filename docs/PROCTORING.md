# AI Proctoring System

SkillTest_AI includes optional browser-based AI proctoring powered by TensorFlow.js. It records integrity signals for staff review; it should not be treated as a standalone fraud verdict.

## Production Caveat

Browser vision is inherently probabilistic. Camera quality, lighting, face angle, network speed, model loading, device performance, browser permissions, and accessibility needs can all cause false positives or false negatives. Before relying on proctoring in production, pilot it with representative users and devices, keep staff review enabled, and document retest/appeal procedures.

---

## How It Works - Overview

```text
Employee starts quiz
  |
  v
Pre-check screen
  |-- Camera permission via getUserMedia
  |-- Microphone permission when configured
  |-- Exactly one centered face visible
  |-- Lighting and camera preview acceptable
  |-- Fullscreen mode active
  `-- Consent checkbox selected
  |
  v
Quiz player loads
  |-- Camera stream stays active
  |-- TensorFlow models load in the browser
  |-- Frame inspection runs every 1.5 seconds
  |-- Browser integrity events are monitored
  |
  v
Violation events are posted to /api/proctoring/events
  |
  v
Risk engine updates attempt summary
  |
  v
High-risk attempt is marked suspicious
  |
  v
Staff review in /manager/integrity
```

---

## Enabling Proctoring

In the quiz create/edit form:

1. Toggle **Enable AI Proctoring** on.
2. Optionally toggle **Require Microphone**.
3. Save the quiz.

The employee will see the pre-check screen the next time they open that quiz.

---

## Vision Detection - `lib/proctoring-vision.ts`

Uses three TensorFlow.js models loaded lazily in the browser:

| Model | What it detects |
|-------|-----------------|
| `MediaPipeFaceDetector` | Face count, face position, face size |
| `MediaPipeFaceMesh` | Gaze direction and face geometry baseline |
| `COCO-SSD` | Objects such as phone, laptop, and book |

### Violation Types And Cooldowns

| Type | What triggers it | Cooldown |
|------|------------------|----------|
| `multiple_faces` | Two or more faces in frame | 4 s |
| `no_face` | No face for 4 seconds | 5 s |
| `gaze_down` | Sustained downward gaze | 10 s |
| `gaze_away` | Sustained side gaze | 10 s |
| `phone_detected` | COCO-SSD cell phone with confidence above threshold | 8 s |
| `electronic_device` | COCO-SSD laptop with confidence above threshold | 8 s |
| `book_detected` | COCO-SSD book with confidence above threshold | 10 s |

### Fail-Open Design

If TensorFlow models fail to load because of a slow network, unsupported browser, or device limitation, the pre-check can fall back to live camera preview. This prevents accidental lockouts, but it also means proctoring confidence should be visible in review/audit workflows.

---

## Browser Integrity Checks

Beyond vision, the quiz player monitors:

| Event | How detected | Violation type |
|-------|--------------|----------------|
| Tab switch | `document.visibilitychange` | `tab-hidden` |
| Window blur | `window.blur` | `window-blur` |
| Fullscreen exit | `document.fullscreenchange` | `fullscreen-exit` |
| Back navigation | `window.popstate` | `back-navigation` |
| Copy, paste, cut | Clipboard events | `copy-attempt`, `paste-attempt` |
| Keyboard shortcuts | `Ctrl`, `Cmd`, `Alt`, `F11`, `PrintScreen` | `blocked-shortcut` |
| Right-click | `contextmenu` | `context-menu` |
| Camera stream lost | Media track `ended` event | `camera-lost` |
| DevTools open | Large `outerWidth - innerWidth` delta | `devtools-open` |
| Long inactivity | No mouse, key, or click for 45 seconds | `blocked-shortcut` |
| Network offline | `window.offline` | `network-offline` |

---

## Risk Engine - `lib/proctoring.ts`

Each violation type has a risk weight. The cumulative risk score is compared against thresholds:

```text
Auto-submit can trigger when:
  violationCount >= PROCTORING_VIOLATION_LIMIT
  OR
  riskScore >= PROCTORING_CRITICAL_RISK_SCORE
```

High-risk violation types such as `phone_detected` and `multiple_faces` carry more weight than lower-risk browser events such as `window-blur`.

---

## Evidence Storage

When a violation is recorded, the quiz player captures a JPEG frame from the camera and sends it with the event payload to `POST /api/proctoring/events`.

Evidence is stored in Supabase Storage:

- Bucket: `quiz-proctoring-evidence`, private.
- Staff review generates short-lived signed URLs.
- Employees' result pages never fetch evidence.

---

## Staff Review - `/manager/integrity`

The Integrity Center shows:

- Suspicious attempts with risk scores, violation counts, and evidence thumbnails.
- A live violation timeline per attempt.
- Candidate profile context and historical integrity data.
- Review outcomes that preserve auditability.

### Review Actions

| Button | What happens |
|--------|--------------|
| **Approve** | Attempt becomes `completed`; score, certificate, and badges are released |
| **Dismiss** | Violations are dismissed; attempt becomes `completed` without penalty |
| **Reject** | Attempt remains flagged |
| **Require Retest** | Attempt is flagged and employee receives a retest path |
| **Escalate** | Attempt is escalated for HR or senior review |

---

## Camera Black Screen Fix

When an employee takes a second proctored quiz in the same browser session, the browser may already show camera permission as granted. The app detects this and calls `getUserMedia()` again to attach the stream so the video preview loads immediately.

---

## Security Boundaries

- Employee quiz payloads strip correct-answer flags before sending data to the browser.
- Answer keys are only fetched after the attempt is submitted/completed.
- Proctoring evidence is stored in a private bucket and exposed only through short-lived signed URLs.
- `/api/proctoring/events` validates authenticated user, attempt ownership, active session, and in-progress status before writing any event.
- Notification and email failures are isolated from event recording, so violations are still logged if email delivery fails.
