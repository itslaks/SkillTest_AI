// ─────────────────────────────────────────────────────────────────────────────
// proctoring-vision.ts  –  AI + DOM proctoring for online assessments
// ─────────────────────────────────────────────────────────────────────────────

export interface ReferenceFaceCapture {
  /** JPEG snapshot taken at quiz start */
  dataUrl: string
  capturedAt: number
  /** Normalized face-geometry vector (100 values) used for identity comparison */
  faceSignature: number[]
  faceConfidence: number
  metadata: {
    faceCount: number
    centered: boolean
    lighting: 'acceptable'
    signatureVersion: string
    videoWidth: number
    videoHeight: number
  }
}

export interface VisionProctoringConfig {
  videoElement: HTMLVideoElement
  canvasElement: HTMLCanvasElement
  onViolation: (violation: VisionViolation) => void
  intervalMs?: number
  /** Emit fullscreen_exit violations when the user leaves fullscreen (default false) */
  requireFullscreen?: boolean
  /** Reference snapshot captured before the quiz started – used for face-match checks */
  referenceCapture?: ReferenceFaceCapture
}

export interface VisionViolation {
  type: string
  label: string
  confidence: number
  evidenceDataUrl: string
  timestamp: number
  detectedCount?: number
  objectLabel?: string
  metadata?: Record<string, unknown>
}

export type CameraVisibilityCheck = {
  status: 'visible' | 'covered' | 'no_face' | 'multiple_faces' | 'partial_face' | 'checking' | 'model_loading' | 'model_error' | 'unsupported'
  message: string
  confidence: number
}

type VisionState = {
  intervalId: number | null
  running: boolean
  lastEmittedAt: Map<string, number>
  noFaceSince: number | null
  gazeRatios: number[]
  yawReadings: number[]
  /** Consecutive-frame counts for each AI violation type */
  frameViolations: Map<string, number>
  /** Cleanup callbacks for DOM listeners */
  domUnsubscribers: Array<() => void>
  /** Normalized face-geometry vector from the reference capture */
  referenceFaceSignature: number[] | null
  /** Timestamp of the last 5-second face-match check */
  lastFaceMatchCheckAt: number
  /** Consecutive 5-second checks that failed the face-match threshold */
  faceMatchFails: number
  /** Consecutive gray-zone face-match checks that are suspicious if repeated */
  faceMatchUncertain: number
}

type ModelBundle = {
  faceDetector: any
  landmarkDetector: any
  objectDetector: any
}

type ProctoringModelLoadResult =
  | { ok: true; models: ModelBundle }
  | { ok: false; error: string; cause?: unknown }

// ── Cooldowns ────────────────────────────────────────────────────────────────
// ── Reference face match ─────────────────────────────────────────────────────
// 50 FaceMesh indices spanning face oval, eyes, nose, brows, and mouth –
// covers enough geometry to discriminate people without expensive embeddings.
const SIGNATURE_INDICES = [
  10, 33, 46, 61, 78, 93, 105, 107, 127, 132,
  133, 136, 144, 148, 149, 150, 152, 160, 172, 176,
  195, 234, 251, 263, 276, 279, 284, 288, 291, 297,
  308, 323, 332, 334, 336, 338, 356, 361, 362, 365,
  373, 377, 378, 379, 387, 389, 397, 400, 402, 454,
]
const FACE_MATCH_THRESHOLD  = 0.86  // cosine-similarity below this → possible substitution
const FACE_MATCH_GRAY_ZONE_THRESHOLD = 0.92
const FACE_MATCH_INTERVAL_MS = 5_000 // check every 5 seconds
const FACE_MATCH_FAIL_COUNT  = 2    // consecutive failing checks before flagging
const FACE_MATCH_UNCERTAIN_COUNT = 3

const COOLDOWN_MS_DEFAULT = 12_000
const COOLDOWN_MS: Record<string, number> = {
  // AI violations
  multiple_faces:     3_000,
  no_face:            3_000,
  'face-covered':     3_000,
  gaze_down:         10_000,
  gaze_away:         10_000,
  phone_detected:     6_000,
  electronic_device:  8_000,
  book_detected:     10_000,
  face_substitution:  30_000, // serious flag, with repeats if it persists
  // DOM violations
  tab_switch:         5_000,
  focus_loss:         5_000,
  fullscreen_exit:    8_000,
  copy_detected:      2_000,
  paste_detected:     2_000,
  right_click:        5_000,
  dev_tools:          5_000,
  screenshot_attempt: 3_000,
  window_switch:      3_000,
}

// ── Detection thresholds ─────────────────────────────────────────────────────
// Lowered to catch more; consensus (below) prevents false-positive spam.
const FACE_SCORE_THRESHOLD   = 0.25   // was 0.35
const PERSON_SCORE_THRESHOLD = 0.22
const PHONE_SCORE_THRESHOLD  = 0.30
const DEVICE_SCORE_THRESHOLD = 0.32   // was 0.40
const BOOK_SCORE_THRESHOLD   = 0.32   // was 0.40

// ── Consensus: N consecutive frames required before emitting ─────────────────
const CONSENSUS: Record<string, number> = {
  multiple_faces:    1,
  phone_detected:    1,
  electronic_device: 1,
  book_detected:     2,
}

// ── Gaze thresholds ──────────────────────────────────────────────────────────
const GAZE_DOWN_RATIO_THRESHOLD = 0.65   // was 0.70
const GAZE_YAW_MEDIAN_DEGREES   = 25     // median yaw (was: all 5 readings > 30)

const NO_FACE_MS = 3_000
const MAX_BUFFER = 5

const PHONE_LABELS  = new Set(['cell phone', 'mobile phone', 'phone'])
const DEVICE_LABELS = new Set(['laptop', 'tablet', 'monitor', 'tv', 'remote', 'keyboard', 'mouse'])
const ACCESSORY_LABELS = new Set(['headphones', 'earbuds', 'smartwatch', 'calculator'])

let modelPromise: Promise<ProctoringModelLoadResult> | null = null
const states = new WeakMap<HTMLVideoElement, VisionState>()

// ── Public API ────────────────────────────────────────────────────────────────

export function startVisionProctoring(config: VisionProctoringConfig) {
  if (typeof window === 'undefined') return
  if (!config.videoElement || !config.canvasElement) return

  stopVisionProctoring(config.videoElement)

  const state: VisionState = {
    intervalId: null,
    running: true,
    lastEmittedAt: new Map(),
    noFaceSince: null,
    gazeRatios: [],
    yawReadings: [],
    frameViolations: new Map(),
    domUnsubscribers: [],
    referenceFaceSignature: config.referenceCapture?.faceSignature ?? null,
    lastFaceMatchCheckAt: 0,
    faceMatchFails: 0,
    faceMatchUncertain: 0,
  }
  states.set(config.videoElement, state)

  // Attach DOM-based proctoring (tab switch, copy/paste, shortcuts …)
  setupDomProctoring(config, state)

  const tick = async () => {
    if (!state.running) return
    try {
      if (emitCoveredCameraViolationIfNeeded(config, state)) return
      const result = await loadProctoringModels()
      if (!result.ok) return
      await inspectFrame(config, state, result.models)
    } catch (error) {
      console.warn('[proctoring-vision] frame inspection failed:', error)
    }
  }

  state.intervalId = window.setInterval(tick, config.intervalMs ?? 1_000)
  void tick()
}

export function stopVisionProctoring(videoElement?: HTMLVideoElement | null) {
  if (!videoElement) return
  const state = states.get(videoElement)
  if (!state) return
  state.running = false
  if (state.intervalId !== null) window.clearInterval(state.intervalId)
  cleanupDomProctoring(state)
  states.delete(videoElement)
}

export async function validateCameraFrameForProctoring(
  videoElement: HTMLVideoElement,
  canvasElement: HTMLCanvasElement,
): Promise<CameraVisibilityCheck> {
  if (typeof window === 'undefined') {
    return { status: 'unsupported', message: 'Camera validation is only available in the browser.', confidence: 0 }
  }
  if (videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
    return { status: 'checking', message: 'Waiting for a live camera frame.', confidence: 0.2 }
  }

  const frame = inspectFramePixels(videoElement, canvasElement)
  if (frame.isCovered) {
    return { status: 'covered', message: 'Camera appears covered or too dark. Remove the cover and keep your face visible.', confidence: frame.confidence }
  }

  const models = await loadProctoringModels()
  if (!models.ok) {
    return { status: 'model_error', message: models.error, confidence: 0 }
  }

  try {
    const faces = await models.models.faceDetector.estimateFaces(videoElement, { flipHorizontal: false })
    if (!faces.length) {
      return { status: 'no_face', message: 'No face is visible. Sit centered in front of the camera before starting.', confidence: 0.95 }
    }
    if (faces.length > 1) {
      return { status: 'multiple_faces', message: 'Only one person may be visible during the camera test.', confidence: averageFaceScore(faces) }
    }

    const box = faceBox(faces[0])
    if (!box) {
      return { status: 'partial_face', message: 'Face position could not be verified. Sit centered and fully visible.', confidence: 0.55 }
    }

    if (!isCenteredFace(box, videoElement.videoWidth, videoElement.videoHeight)) {
      return { status: 'partial_face', message: 'Your full face must be centered and clearly visible in the camera frame.', confidence: averageFaceScore(faces) }
    }

    return { status: 'visible', message: 'Face verified. Camera proctoring is ready.', confidence: averageFaceScore(faces) }
  } catch (error) {
    console.warn('[proctoring-vision] camera visibility check failed:', error)
    return { status: 'model_error', message: 'AI proctoring model failed to load. Please refresh or contact admin.', confidence: 0 }
  }
}

// ── DOM-based Proctoring ──────────────────────────────────────────────────────

function setupDomProctoring(config: VisionProctoringConfig, state: VisionState) {
  // Helper: attach + register cleanup in one call
  const on = <T extends Event>(
    target: EventTarget,
    type: string,
    handler: (e: T) => void,
    opts?: AddEventListenerOptions,
  ) => {
    const wrapped = handler as EventListener
    target.addEventListener(type, wrapped, opts)
    state.domUnsubscribers.push(() => target.removeEventListener(type, wrapped, opts))
  }

  // ── Tab switch ──────────────────────────────────────────────────────────────
  on(document, 'visibilitychange', () => {
    if (document.hidden) {
      fireViolation(config, state, 'tab_switch', 'Tab switch detected — exam tab is no longer active.', 0.99)
    }
  })

  // ── Another window/app gained focus ────────────────────────────────────────
  let blurTimer: ReturnType<typeof setTimeout> | null = null
  on<FocusEvent>(window, 'blur', () => {
    blurTimer = setTimeout(() => {
      if (!document.hasFocus() && !document.hidden) {
        fireViolation(config, state, 'focus_loss', 'Focus moved to another application or window.', 0.95)
      }
    }, 300)
  })
  on<FocusEvent>(window, 'focus', () => {
    if (blurTimer !== null) { clearTimeout(blurTimer); blurTimer = null }
  })

  // ── Fullscreen exit (opt-in) ────────────────────────────────────────────────
  if (config.requireFullscreen) {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        fireViolation(config, state, 'fullscreen_exit', 'Fullscreen mode exited during the exam.', 0.99)
      }
    }
    on(document, 'fullscreenchange', onFsChange)
    on(document, 'webkitfullscreenchange', onFsChange)
  }

  // ── Copy / Cut / Paste ──────────────────────────────────────────────────────
  on(document, 'copy', () => {
    fireViolation(config, state, 'copy_detected', 'Content copy attempt detected.', 0.99)
  })
  on(document, 'cut', () => {
    fireViolation(config, state, 'copy_detected', 'Content cut attempt detected.', 0.99)
  })
  on(document, 'paste', () => {
    fireViolation(config, state, 'paste_detected', 'Paste attempt detected.', 0.99)
  })

  // ── Right-click (suppress menu + flag) ─────────────────────────────────────
  on<MouseEvent>(document, 'contextmenu', (e) => {
    e.preventDefault()
    fireViolation(config, state, 'right_click', 'Right-click attempt detected.', 0.99)
  })

  // ── Suspicious keyboard shortcuts ──────────────────────────────────────────
  on<KeyboardEvent>(document, 'keydown', (e) => {
    const key   = e.key
    const ctrl  = e.ctrlKey || e.metaKey
    const shift = e.shiftKey

    // Screenshot
    if (key === 'PrintScreen') {
      fireViolation(config, state, 'screenshot_attempt', 'Screenshot key detected.', 0.95)
      return
    }

    // Developer tools: F12 | Ctrl+Shift+{I,J,C,K} | Ctrl+U
    if (
      key === 'F12' ||
      (ctrl && shift && ['I', 'J', 'C', 'K'].includes(key)) ||
      (ctrl && key === 'u')
    ) {
      e.preventDefault()
      fireViolation(config, state, 'dev_tools', 'Developer tools shortcut detected.', 0.95)
      return
    }

    // Alt+Tab — OS usually intercepts, but catch if the browser sees it
    if (e.altKey && key === 'Tab') {
      fireViolation(config, state, 'window_switch', 'Window switch shortcut detected (Alt+Tab).', 0.9)
    }
  })
}

function cleanupDomProctoring(state: VisionState) {
  for (const unsub of state.domUnsubscribers) unsub()
  state.domUnsubscribers = []
}

/** Emit a violation triggered by a DOM event (bypasses consensus, uses cooldown only). */
function fireViolation(
  config: VisionProctoringConfig,
  state: VisionState,
  type: string,
  label: string,
  confidence: number,
) {
  emitViolation(config, state, { type, label, confidence, timestamp: Date.now() })
}

// ── AI Frame Inspection ───────────────────────────────────────────────────────

function emitCoveredCameraViolationIfNeeded(config: VisionProctoringConfig, state: VisionState) {
  const video = config.videoElement
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return false
  const frame = inspectFramePixels(video, config.canvasElement)
  if (!frame.isCovered) return false

  state.noFaceSince = null
  advanceConsensus(state, 'multiple_faces', false, CONSENSUS.multiple_faces)
  emitViolation(config, state, {
    type: 'face-covered',
    label: 'Camera appears covered or too dark. Keep your face clearly visible during the assessment.',
    confidence: frame.confidence,
    timestamp: Date.now(),
  })
  return true
}

async function inspectFrame(config: VisionProctoringConfig, state: VisionState, models: ModelBundle) {
  const video = config.videoElement
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return

  const now = Date.now()
  const frame = inspectFramePixels(video, config.canvasElement)
  if (frame.isCovered) {
    state.noFaceSince = null
    advanceConsensus(state, 'multiple_faces', false, CONSENSUS.multiple_faces)
    emitViolation(config, state, {
      type: 'face-covered',
      label: 'Camera appears covered or too dark. Keep your face clearly visible during the assessment.',
      confidence: frame.confidence,
      timestamp: now,
    })
    return
  }

  // Run face detection and object detection in parallel for speed
  const [faces, predictions] = await Promise.all([
    models.faceDetector.estimateFaces(video, { flipHorizontal: false }) as Promise<any[]>,
    models.objectDetector.detect(video) as Promise<any[]>,
  ])

  // ── Cross-validate face count using COCO-SSD "person" class ──────────────
  // COCO-SSD can see bodies that the face detector misses (profiles, partial faces)
  const cocoPersonCount = (predictions ?? []).filter(
    (p: any) => String(p.class || '').toLowerCase() === 'person' && Number(p.score || 0) > PERSON_SCORE_THRESHOLD,
  ).length
  const effectiveFaceCount = Math.max(faces.length, cocoPersonCount)

  // ── Multiple people ───────────────────────────────────────────────────────
  const shouldFireMultipleFaces = advanceConsensus(state, 'multiple_faces', effectiveFaceCount >= 2, CONSENSUS.multiple_faces)
  if (effectiveFaceCount >= 2) {
    state.noFaceSince = null
    if (shouldFireMultipleFaces) {
      emitViolation(config, state, {
        type: 'multiple_faces',
        label: `Multiple faces detected: ${effectiveFaceCount} faces visible`,
        confidence: Math.min(0.99, averageFaceScore(faces) || 0.85),
        detectedCount: effectiveFaceCount,
        metadata: {
          faceDetectorCount: faces.length,
          personDetectorCount: cocoPersonCount,
        },
        timestamp: now,
      })
    }
  } else if (faces.length === 0) {
    // ── No face ──────────────────────────────────────────────────────────────
    state.noFaceSince ??= now
    if (now - state.noFaceSince > NO_FACE_MS) {
      emitViolation(config, state, {
        type: 'no_face',
        label: 'Face not visible',
        confidence: 0.9,
        timestamp: now,
      })
    }
  } else {
    // ── Single face — gaze + 5-second reference-face match ───────────────
    state.noFaceSince = null
    // Fetch FaceMesh landmarks once and share between gaze check + match check
    const landmarkFaces = await models.landmarkDetector.estimateFaces(video, { flipHorizontal: false })
    inspectGazeFaces(config, state, landmarkFaces, now)

    // Every 5 s: compare current face geometry against the reference snapshot
    if (state.referenceFaceSignature && now - state.lastFaceMatchCheckAt >= FACE_MATCH_INTERVAL_MS) {
      state.lastFaceMatchCheckAt = now
      const lmFace = landmarkFaces?.[0]
      if (lmFace) {
        const kps: Array<{ x: number; y: number }> = lmFace.keypoints ?? []
        const box = faceBox(lmFace)
        if (box && kps.length >= 100) {
          const currentSig = buildFaceSignature(kps, box)
          const similarity = cosineSimilarity(state.referenceFaceSignature, currentSig)
          if (similarity < FACE_MATCH_THRESHOLD) {
            state.faceMatchFails = Math.min(state.faceMatchFails + 1, FACE_MATCH_FAIL_COUNT)
            state.faceMatchUncertain = 0
            if (state.faceMatchFails >= FACE_MATCH_FAIL_COUNT) {
              state.faceMatchFails = 0
              emitViolation(config, state, {
                type: 'face_substitution',
                label: 'Different person detected',
                confidence: Math.min(0.99, 1 - similarity + 0.1),
                metadata: {
                  similarity,
                  threshold: FACE_MATCH_THRESHOLD,
                  matchState: 'failed',
                },
                timestamp: now,
              })
            }
          } else if (similarity < FACE_MATCH_GRAY_ZONE_THRESHOLD) {
            state.faceMatchFails = 0
            state.faceMatchUncertain = Math.min(state.faceMatchUncertain + 1, FACE_MATCH_UNCERTAIN_COUNT)
            if (state.faceMatchUncertain >= FACE_MATCH_UNCERTAIN_COUNT) {
              state.faceMatchUncertain = 0
              emitViolation(config, state, {
                type: 'face_substitution',
                label: 'Different person detected',
                confidence: Math.min(0.85, 1 - similarity + 0.15),
                metadata: {
                  similarity,
                  threshold: FACE_MATCH_GRAY_ZONE_THRESHOLD,
                  matchState: 'uncertain_repeated',
                },
                timestamp: now,
              })
            }
          } else {
            state.faceMatchFails = 0
            state.faceMatchUncertain = 0
          }
        }
      }
    }
  }

  // ── Objects: phones, devices, books ──────────────────────────────────────
  inspectObjectViolations(config, state, predictions ?? [], now)
}

function inspectGazeFaces(
  config: VisionProctoringConfig,
  state: VisionState,
  faces: any[],
  now: number,
) {
  const face = faces?.[0]
  const keypoints: Array<{ name?: string; x: number; y: number }> = face?.keypoints ?? []
  if (!face || keypoints.length === 0) return

  const leftEye    = namedPoint(keypoints, ['leftEye',   'left eye'])
  const rightEye   = namedPoint(keypoints, ['rightEye',  'right eye'])
  const noseTip    = namedPoint(keypoints, ['noseTip',   'nose tip'])
  const lips       = namedPoint(keypoints, ['lips',      'mouthCenter', 'mouth center'])
  const leftCheek  = namedPoint(keypoints, ['leftCheek', 'left cheek'])
  const rightCheek = namedPoint(keypoints, ['rightCheek','right cheek'])
  if (!leftEye || !rightEye || !noseTip) return

  // ── Downward gaze (possible note reading) ────────────────────────────────
  if (lips) {
    const eyeY       = (leftEye.y + rightEye.y) / 2
    const faceHeight = Math.max(1, Math.abs(lips.y - eyeY))
    pushReading(state.gazeRatios, (noseTip.y - eyeY) / faceHeight)
    if (
      state.gazeRatios.length >= MAX_BUFFER &&
      median(state.gazeRatios) > GAZE_DOWN_RATIO_THRESHOLD
    ) {
      emitViolation(config, state, {
        type: 'gaze_down',
        label: 'Sustained downward gaze detected — possible note-reading.',
        confidence: Math.min(0.99, median(state.gazeRatios)),
        timestamp: now,
      })
    }
  }

  // ── Lateral face-turn / looking away (yaw) ───────────────────────────────
  if (leftCheek && rightCheek) {
    const faceWidth  = Math.max(1, Math.abs(rightCheek.x - leftCheek.x))
    const centerX    = (leftCheek.x + rightCheek.x) / 2
    const yawDegrees = Math.abs(((noseTip.x - centerX) / faceWidth) * 90)
    pushReading(state.yawReadings, yawDegrees)
    if (
      state.yawReadings.length >= MAX_BUFFER &&
      median(state.yawReadings) > GAZE_YAW_MEDIAN_DEGREES
    ) {
      emitViolation(config, state, {
        type: 'gaze_away',
        label: 'Face turned away from screen for an extended period.',
        confidence: Math.min(0.99, median(state.yawReadings) / 45),
        timestamp: now,
      })
    }
  }
}

function inspectObjectViolations(
  config: VisionProctoringConfig,
  state: VisionState,
  predictions: any[],
  now: number,
) {
  // Collect best scores for this frame
  let bestPhoneScore  = 0
  let bestPhoneLabel: string | null = null
  let bestBookScore   = 0
  const deviceScores  = new Map<string, number>()

  for (const pred of predictions) {
    const label = String(pred.class || '').toLowerCase()
    const score = Number(pred.score || 0)

    // ── Phone ───────────────────────────────────────────────────────────────
    // COCO-SSD frequently misclassifies phones as "remote"; we cover both.
    // Immediate once confidence clears threshold; cooldowns prevent repeated warning spam.
    if (PHONE_LABELS.has(label) && score > PHONE_SCORE_THRESHOLD) {
      bestPhoneScore = Math.max(bestPhoneScore, score)
      bestPhoneLabel = label
    }

    // ── Electronic devices ───────────────────────────────────────────────────
    if ((DEVICE_LABELS.has(label) || ACCESSORY_LABELS.has(label)) && score > DEVICE_SCORE_THRESHOLD) {
      deviceScores.set(label, Math.max(deviceScores.get(label) ?? 0, score))
    }

    // ── Book / notes ─────────────────────────────────────────────────────────
    if (label === 'book' && score > BOOK_SCORE_THRESHOLD) {
      bestBookScore = Math.max(bestBookScore, score)
    }
  }

  // ── Emit phone (consensus-gated) ─────────────────────────────────────────
  if (advanceConsensus(state, 'phone_detected', bestPhoneScore > 0, CONSENSUS.phone_detected)) {
    emitViolation(config, state, {
      type: 'phone_detected',
      label: 'Mobile phone detected',
      confidence: Math.min(0.99, bestPhoneScore),
      objectLabel: bestPhoneLabel || 'cell phone',
      metadata: { objectLabel: bestPhoneLabel || 'cell phone' },
      timestamp: now,
    })
  }

  // ── Emit each device type separately (consensus-gated) ────────────────────
  for (const label of new Set([...DEVICE_LABELS, ...ACCESSORY_LABELS])) {
    const score   = deviceScores.get(label) ?? 0
    const present = score > 0
    if (advanceConsensus(state, `device_${label}`, present, CONSENSUS.electronic_device) && present) {
      const displayLabel = label.replace(/\b\w/g, (char) => char.toUpperCase())
      emitViolation(config, state, {
        type: 'electronic_device',
        label: `${displayLabel} detected`,
        confidence: score,
        objectLabel: label,
        metadata: { objectLabel: label },
        timestamp: now,
      })
    }
  }

  // ── Emit book (consensus-gated) ───────────────────────────────────────────
  if (advanceConsensus(state, 'book_detected', bestBookScore > 0, CONSENSUS.book_detected)) {
    emitViolation(config, state, {
      type: 'book_detected',
      label: 'Book or notes detected in camera frame.',
      confidence: Math.min(0.99, bestBookScore),
      timestamp: now,
    })
  }
}

// ── Consensus Helper ──────────────────────────────────────────────────────────

/**
 * Increments or decrements the per-type consecutive-frame counter.
 * Returns true only after `required` consecutive positive frames.
 * On absence, the count decays by 1 per frame (avoids instant reset on brief gaps).
 */
function advanceConsensus(
  state: VisionState,
  key: string,
  detected: boolean,
  required: number,
): boolean {
  const current = state.frameViolations.get(key) ?? 0
  if (detected) {
    const next = Math.min(current + 1, required) // cap to avoid overflow
    state.frameViolations.set(key, next)
    return next >= required
  }
  state.frameViolations.set(key, Math.max(0, current - 1))
  return false
}

// ── Violation Emitter ─────────────────────────────────────────────────────────

function emitViolation(
  config: VisionProctoringConfig,
  state: VisionState,
  violation: Omit<VisionViolation, 'evidenceDataUrl'>,
) {
  const cooldown = COOLDOWN_MS[violation.type] ?? COOLDOWN_MS_DEFAULT
  const last     = state.lastEmittedAt.get(violation.type) ?? 0
  if (violation.timestamp - last < cooldown) return
  state.lastEmittedAt.set(violation.type, violation.timestamp)
  config.onViolation({
    ...violation,
    evidenceDataUrl: captureFrame(config.videoElement, config.canvasElement),
  })
}

// ── Reference face capture (called once before the quiz starts) ──────────────

/**
 * Captures the employee's reference face before the quiz begins.
 * The returned `faceSignature` is passed to `startVisionProctoring` and used
 * every 5 seconds to detect if a different person is in front of the camera.
 */
export async function captureReferenceFace(
  videoElement: HTMLVideoElement,
  canvasElement: HTMLCanvasElement,
): Promise<ReferenceFaceCapture | null> {
  if (typeof window === 'undefined') return null
  if (videoElement.readyState < 2 || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) return null

  try {
    const result = await loadProctoringModels()
    if (!result.ok) return null
    const models = result.models

    const frame = inspectFramePixels(videoElement, canvasElement)
    if (frame.isCovered) return null

    const detectedFaces = await models.faceDetector.estimateFaces(videoElement, { flipHorizontal: false }) as any[]
    if (detectedFaces.length !== 1) return null
    const detectedBox = faceBox(detectedFaces[0])
    if (!detectedBox || !isCenteredFace(detectedBox, videoElement.videoWidth, videoElement.videoHeight)) return null

    const faces = await models.landmarkDetector.estimateFaces(videoElement, { flipHorizontal: false })
    if (faces.length !== 1) return null
    const face = faces[0]

    const keypoints: Array<{ x: number; y: number }> = face.keypoints ?? []
    const box = faceBox(face)
    if (!box || keypoints.length < 100 || !isCenteredFace(box, videoElement.videoWidth, videoElement.videoHeight)) return null

    const faceSignature = buildFaceSignature(keypoints, box)
    const dataUrl       = captureFrame(videoElement, canvasElement)
    return {
      dataUrl,
      capturedAt: Date.now(),
      faceSignature,
      faceConfidence: averageFaceScore(detectedFaces),
      metadata: {
        faceCount: 1,
        centered: true,
        lighting: 'acceptable',
        signatureVersion: 'facemesh-geometry-v1',
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight,
      },
    }
  } catch (error) {
    console.warn('[proctoring-vision] reference face capture failed:', error)
    return null
  }
}

function buildFaceSignature(
  keypoints: Array<{ x: number; y: number }>,
  box: { x: number; y: number; width: number; height: number },
): number[] {
  const sig: number[] = []
  for (const idx of SIGNATURE_INDICES) {
    const kp = keypoints[idx]
    if (kp) {
      sig.push((kp.x - box.x) / Math.max(1, box.width), (kp.y - box.y) / Math.max(1, box.height))
    } else {
      sig.push(0, 0)
    }
  }
  return sig
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom < 1e-10 ? 0 : dot / denom
}

// ── Model Loading ─────────────────────────────────────────────────────────────

export async function loadProctoringModels(): Promise<ProctoringModelLoadResult> {
  if (typeof window === 'undefined') {
    return { ok: false, error: 'AI proctoring models can only load in the browser.' }
  }
  if (modelPromise) return modelPromise

  modelPromise = (async () => {
    try {
      const tf = await import('@tensorflow/tfjs')
      const backend = await prepareTensorflowBackend(tf)
      if (!backend) {
        return { ok: false, error: 'AI proctoring model failed to load. Please refresh or contact admin.' }
      }

      const [faceDetection, faceLandmarksDetection, cocoSsd] = await Promise.all([
        import('@tensorflow-models/face-detection'),
        import('@tensorflow-models/face-landmarks-detection'),
        import('@tensorflow-models/coco-ssd'),
      ])
      const faceDetectionRuntime = faceDetection as any
      const faceLandmarksRuntime = faceLandmarksDetection as any
      const cocoSsdRuntime = cocoSsd as any

      // Load all three models in parallel to reduce startup time
      const [faceDetector, landmarkDetector, objectDetector] = await Promise.all([
        faceDetectionRuntime.createDetector(
          faceDetectionRuntime.SupportedModels.MediaPipeFaceDetector,
          { runtime: 'tfjs', modelType: 'short', maxFaces: 8, scoreThreshold: FACE_SCORE_THRESHOLD },
        ),
        faceLandmarksRuntime.createDetector(
          faceLandmarksRuntime.SupportedModels.MediaPipeFaceMesh,
          { runtime: 'tfjs', refineLandmarks: true },
        ),
        cocoSsdRuntime.load(),
      ])

      return { ok: true, models: { faceDetector, landmarkDetector, objectDetector } }
    } catch (error) {
      console.error('[proctoring-vision] model load failed:', error)
      return {
        ok: false,
        error: 'AI proctoring model failed to load. Please refresh or contact admin.',
        cause: error,
      }
    }
  })()

  return modelPromise
}

export function resetProctoringModelCache() {
  modelPromise = null
}

async function prepareTensorflowBackend(tf: any): Promise<string | null> {
  if (hasWebGlSupport()) {
    try {
      await tf.setBackend('webgl')
      await tf.ready()
      return 'webgl'
    } catch (error) {
      console.warn('[proctoring-vision] WebGL unavailable; falling back to CPU.', error)
    }
  }
  try {
    await tf.setBackend('cpu')
    await tf.ready()
    return 'cpu'
  } catch (error) {
    console.warn('[proctoring-vision] TensorFlow backend unavailable:', error)
    return null
  }
}

function hasWebGlSupport(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  } catch {
    return false
  }
}


// ── Frame / Pixel Helpers ─────────────────────────────────────────────────────

function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): string {
  const sourceWidth  = video.videoWidth  || 640
  const sourceHeight = video.videoHeight || 480
  const ratio  = Math.min(800 / sourceWidth, 600 / sourceHeight, 1)
  const width  = Math.max(1, Math.round(sourceWidth  * ratio))
  const height = Math.max(1, Math.round(sourceHeight * ratio))
  canvas.width  = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(video, 0, 0, width, height)
  let quality = 0.7
  let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length > 1_100_000 && quality > 0.35) {
    quality -= 0.08
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }
  return dataUrl
}

function inspectFramePixels(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const sampleWidth  = 96
  const sampleHeight = Math.max(54, Math.round((video.videoHeight / Math.max(1, video.videoWidth)) * sampleWidth))
  canvas.width  = sampleWidth
  canvas.height = sampleHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { isCovered: false, confidence: 0 }
  ctx.drawImage(video, 0, 0, sampleWidth, sampleHeight)
  const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight)
  let sum = 0, sumSquares = 0
  for (let i = 0; i < data.length; i += 4) {
    const lum   = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    sum        += lum
    sumSquares += lum * lum
  }
  const count     = data.length / 4
  const mean      = sum / count
  const variance  = Math.max(0, sumSquares / count - mean * mean)
  const contrast  = Math.sqrt(variance)
  const isCovered = mean < 0.08 || (mean < 0.16 && contrast < 0.035)
  return {
    isCovered,
    confidence: isCovered ? Math.min(0.98, 1 - mean + (0.08 - Math.min(0.08, contrast))) : 0.4,
  }
}

function faceBox(face: any): { x: number; y: number; width: number; height: number } | null {
  const box = face.box || face.boundingBox
  if (!box) return faceBoxFromKeypoints(face?.keypoints)

  const topLeft = readPoint(box.topLeft)
  const bottomRight = readPoint(box.bottomRight)
  const x = firstFinite(box.xMin, box.x, box.left, topLeft?.x)
  const y = firstFinite(box.yMin, box.y, box.top, topLeft?.y)
  if (x === null || y === null) return faceBoxFromKeypoints(face?.keypoints)

  const xMax = firstFinite(box.xMax, box.right, bottomRight?.x)
  const yMax = firstFinite(box.yMax, box.bottom, bottomRight?.y)
  const width = firstFinite(box.width, xMax === null ? null : xMax - x)
  const height = firstFinite(box.height, yMax === null ? null : yMax - y)
  if (width === null || height === null) return faceBoxFromKeypoints(face?.keypoints)
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

function readPoint(point: unknown): { x: number; y: number } | null {
  if (!point) return null
  const value = Array.isArray(point) && Array.isArray(point[0]) ? point[0] : point
  if (Array.isArray(value)) {
    const x = Number(value[0])
    const y = Number(value[1])
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const x = Number(record.x ?? record[0])
    const y = Number(record.y ?? record[1])
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  }
  return null
}

function firstFinite(...values: Array<unknown>): number | null {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const numberValue = Number(value)
    if (Number.isFinite(numberValue)) return numberValue
  }
  return null
}

function faceBoxFromKeypoints(keypoints: unknown): { x: number; y: number; width: number; height: number } | null {
  if (!Array.isArray(keypoints) || keypoints.length === 0) return null
  const points = keypoints
    .map(readPoint)
    .filter((point): point is { x: number; y: number } => Boolean(point))
  if (points.length < 2) return null

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  const width = Math.max(...xs) - x
  const height = Math.max(...ys) - y
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

function isCenteredFace(
  box: { x: number; y: number; width: number; height: number },
  videoWidth: number,
  videoHeight: number,
) {
  const width = videoWidth || 1
  const height = videoHeight || 1
  const faceArea = (box.width * box.height) / (width * height)
  const faceCenterX = box.x + box.width / 2
  const faceCenterY = box.y + box.height / 2
  const safelyInsideFrame = (
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= width &&
    box.y + box.height <= height
  )
  const centeredEnough = (
    faceCenterX >= width * 0.18 &&
    faceCenterX <= width * 0.82 &&
    faceCenterY >= height * 0.12 &&
    faceCenterY <= height * 0.88
  )

  return (
    safelyInsideFrame &&
    centeredEnough &&
    faceArea >= 0.02 &&
    faceArea <= 0.82
  )
}

function namedPoint(
  points: Array<{ name?: string; x: number; y: number }>,
  names: string[],
) {
  return points.find((p) => {
    const name = p.name?.toLowerCase()
    return name ? names.some((expected) => name === expected.toLowerCase()) : false
  })
}

function pushReading(buffer: number[], value: number) {
  buffer.push(value)
  if (buffer.length > MAX_BUFFER) buffer.shift()
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

function averageFaceScore(faces: any[]): number {
  const scores = faces
    .map((f) => Number(f.score ?? f.box?.score ?? 0.8))
    .filter(Number.isFinite)
  if (!scores.length) return 0.8
  return scores.reduce((sum, s) => sum + s, 0) / scores.length
}

