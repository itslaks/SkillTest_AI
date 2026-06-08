export interface VisionProctoringConfig {
  videoElement: HTMLVideoElement
  canvasElement: HTMLCanvasElement
  onViolation: (violation: VisionViolation) => void
  intervalMs?: number
}

export interface VisionViolation {
  type: string
  label: string
  confidence: number
  evidenceDataUrl: string
  timestamp: number
}

export type CameraVisibilityCheck = {
  status: 'visible' | 'covered' | 'no_face' | 'multiple_faces' | 'partial_face' | 'checking' | 'unsupported'
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
}

type ModelBundle = {
  faceDetector: any
  landmarkDetector: any
  objectDetector: any
}

const COOLDOWN_MS = 15_000
const NO_FACE_MS = 5_000
const MAX_BUFFER = 6
let modelPromise: Promise<ModelBundle | null> | null = null
let faceDetectorPromise: Promise<any | null> | null = null
const states = new WeakMap<HTMLVideoElement, VisionState>()

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
  }
  states.set(config.videoElement, state)

  const tick = async () => {
    if (!state.running) return
    try {
      const models = await loadModels()
      if (!models) return
      await inspectFrame(config, state, models)
    } catch (error) {
      console.warn('[proctoring-vision] frame inspection failed open:', error)
    }
  }

  state.intervalId = window.setInterval(tick, config.intervalMs ?? 1500)
  void tick()
}

export function stopVisionProctoring(videoElement?: HTMLVideoElement | null) {
  if (!videoElement) return
  const state = states.get(videoElement)
  if (!state) return
  state.running = false
  if (state.intervalId !== null) window.clearInterval(state.intervalId)
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

  const detector = await loadFaceDetector()
  if (!detector) {
    return cameraPreviewFallback()
  }

  try {
    const faces = await detector.estimateFaces(videoElement, { flipHorizontal: false })
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

    const width = videoElement.videoWidth || 1
    const height = videoElement.videoHeight || 1
    const faceArea = (box.width * box.height) / (width * height)
    const marginX = width * 0.04
    const marginY = height * 0.04
    const centeredEnough = box.x >= marginX && box.y >= marginY && (box.x + box.width) <= width - marginX && (box.y + box.height) <= height - marginY
    const sizedEnough = faceArea >= 0.07 && faceArea <= 0.72

    if (!centeredEnough || !sizedEnough) {
      return { status: 'partial_face', message: 'Your full face must be centered and clearly visible in the camera frame.', confidence: averageFaceScore(faces) }
    }

    return { status: 'visible', message: 'Face verified. Camera proctoring is ready.', confidence: averageFaceScore(faces) }
  } catch (error) {
    console.warn('[proctoring-vision] camera visibility check failed:', error)
    return cameraPreviewFallback()
  }
}

async function loadModels(): Promise<ModelBundle | null> {
  if (typeof window === 'undefined') return null
  if (modelPromise) return modelPromise

  modelPromise = (async () => {
    try {
      const tf = await runtimeImport('@tensorflow/tfjs')
      const backend = await prepareTensorflowBackend(tf)
      if (!backend) return null

      const [faceDetection, faceLandmarksDetection, cocoSsd] = await Promise.all([
        runtimeImport('@tensorflow-models/face-detection'),
        runtimeImport('@tensorflow-models/face-landmarks-detection'),
        runtimeImport('@tensorflow-models/coco-ssd'),
      ])

      const faceDetector = await faceDetection.createDetector(
        faceDetection.SupportedModels.MediaPipeFaceDetector,
        { runtime: 'tfjs', modelType: 'short' },
      )
      const landmarkDetector = await faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        { runtime: 'tfjs', refineLandmarks: true },
      )
      const objectDetector = await cocoSsd.load()

      return { faceDetector, landmarkDetector, objectDetector }
    } catch (error) {
      console.warn('[proctoring-vision] model load failed open:', error)
      return null
    }
  })()

  return modelPromise
}

async function loadFaceDetector() {
  if (faceDetectorPromise) return faceDetectorPromise

  faceDetectorPromise = (async () => {
    try {
      const tf = await runtimeImport('@tensorflow/tfjs')
      const backend = await prepareTensorflowBackend(tf)
      if (!backend) return null
      const faceDetection = await runtimeImport('@tensorflow-models/face-detection')
      return faceDetection.createDetector(
        faceDetection.SupportedModels.MediaPipeFaceDetector,
        { runtime: 'tfjs', modelType: 'short' },
      )
    } catch (error) {
      console.warn('[proctoring-vision] face detector load failed:', error)
      return null
    }
  })()

  return faceDetectorPromise
}

async function prepareTensorflowBackend(tf: any) {
  if (hasWebGlSupport()) {
    try {
      await tf.setBackend('webgl')
      await tf.ready()
      return 'webgl'
    } catch (error) {
      console.warn('[proctoring-vision] WebGL backend unavailable; trying CPU face detection.', error)
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

function hasWebGlSupport() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  } catch {
    return false
  }
}

function cameraPreviewFallback(): CameraVisibilityCheck {
  return {
    status: 'visible',
    message: 'Camera preview is live. Advanced face verification is unavailable in this browser, so keep your full face inside the preview while you continue.',
    confidence: 0.45,
  }
}

async function inspectFrame(config: VisionProctoringConfig, state: VisionState, models: ModelBundle) {
  const video = config.videoElement
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return

  const faces = await models.faceDetector.estimateFaces(video, { flipHorizontal: false })
  const now = Date.now()

  if (faces.length >= 2) {
    state.noFaceSince = null
    emitViolation(config, state, {
      type: 'multiple_faces',
      label: 'Multiple faces detected in camera frame.',
      confidence: averageFaceScore(faces),
      timestamp: now,
    })
  } else if (faces.length === 0) {
    state.noFaceSince ??= now
    if (now - state.noFaceSince > NO_FACE_MS) {
      emitViolation(config, state, {
        type: 'no_face',
        label: 'No face detected in camera frame.',
        confidence: 0.9,
        timestamp: now,
      })
    }
  } else {
    state.noFaceSince = null
    await inspectGaze(config, state, models, now)
  }

  await inspectObjects(config, state, models, now)
}

async function inspectGaze(config: VisionProctoringConfig, state: VisionState, models: ModelBundle, now: number) {
  const faces = await models.landmarkDetector.estimateFaces(config.videoElement, { flipHorizontal: false })
  const face = faces[0]
  const keypoints = face?.keypoints || []
  if (!face || keypoints.length === 0) return

  const leftEye = namedPoint(keypoints, ['leftEye', 'left eye'])
  const rightEye = namedPoint(keypoints, ['rightEye', 'right eye'])
  const noseTip = namedPoint(keypoints, ['noseTip', 'nose tip'])
  const lips = namedPoint(keypoints, ['lips', 'mouthCenter', 'mouth center'])
  const leftCheek = namedPoint(keypoints, ['leftCheek', 'left cheek'])
  const rightCheek = namedPoint(keypoints, ['rightCheek', 'right cheek'])
  if (!leftEye || !rightEye || !noseTip) return

  if (lips) {
    const eyeY = (leftEye.y + rightEye.y) / 2
    const faceHeight = Math.max(1, Math.abs(lips.y - eyeY))
    pushReading(state.gazeRatios, (noseTip.y - eyeY) / faceHeight)
    if (state.gazeRatios.length === MAX_BUFFER && median(state.gazeRatios) > 0.7) {
      emitViolation(config, state, {
        type: 'gaze_down',
        label: 'Downward gaze detected for an extended period.',
        confidence: Math.min(0.99, median(state.gazeRatios)),
        timestamp: now,
      })
    }
  }

  if (leftCheek && rightCheek) {
    const faceWidth = Math.max(1, Math.abs(rightCheek.x - leftCheek.x))
    const centerX = (leftCheek.x + rightCheek.x) / 2
    const yawDegrees = Math.abs(((noseTip.x - centerX) / faceWidth) * 90)
    pushReading(state.yawReadings, yawDegrees)
    if (state.yawReadings.length === MAX_BUFFER && state.yawReadings.every((reading) => reading > 30)) {
      emitViolation(config, state, {
        type: 'gaze_away',
        label: 'Face turned away from assessment screen.',
        confidence: Math.min(0.99, median(state.yawReadings) / 45),
        timestamp: now,
      })
    }
  }
}

async function inspectObjects(config: VisionProctoringConfig, state: VisionState, models: ModelBundle, now: number) {
  const predictions = await models.objectDetector.detect(config.videoElement)
  for (const prediction of predictions || []) {
    const label = String(prediction.class || '').toLowerCase()
    const score = Number(prediction.score || 0)
    if (label === 'cell phone' && score > 0.55) {
      emitViolation(config, state, { type: 'phone_detected', label: 'Cell phone detected in camera frame.', confidence: score, timestamp: now })
    }
    if (label === 'laptop' && score > 0.55) {
      emitViolation(config, state, { type: 'electronic_device', label: 'Additional electronic device detected.', confidence: score, timestamp: now })
    }
    if (label === 'book' && score > 0.5) {
      emitViolation(config, state, { type: 'book_detected', label: 'Book or notes detected in camera frame.', confidence: score, timestamp: now })
    }
  }
}

function emitViolation(
  config: VisionProctoringConfig,
  state: VisionState,
  violation: Omit<VisionViolation, 'evidenceDataUrl'>,
) {
  const last = state.lastEmittedAt.get(violation.type) || 0
  if (violation.timestamp - last < COOLDOWN_MS) return
  state.lastEmittedAt.set(violation.type, violation.timestamp)
  config.onViolation({
    ...violation,
    evidenceDataUrl: captureFrame(config.videoElement, config.canvasElement),
  })
}

function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const sourceWidth = video.videoWidth || 640
  const sourceHeight = video.videoHeight || 480
  const ratio = Math.min(800 / sourceWidth, 600 / sourceHeight, 1)
  const width = Math.max(1, Math.round(sourceWidth * ratio))
  const height = Math.max(1, Math.round(sourceHeight * ratio))
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return ''
  context.drawImage(video, 0, 0, width, height)
  let quality = 0.7
  let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length > 1_100_000 && quality > 0.35) {
    quality -= 0.08
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }
  return dataUrl
}

function namedPoint(points: Array<{ name?: string; x: number; y: number }>, names: string[]) {
  return points.find((point) => {
    const name = point.name?.toLowerCase()
    return name ? names.some((expected) => name === expected.toLowerCase()) : false
  })
}

function pushReading(buffer: number[], value: number) {
  buffer.push(value)
  if (buffer.length > MAX_BUFFER) buffer.shift()
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] || 0
}

function averageFaceScore(faces: any[]) {
  const scores = faces.map((face) => Number(face.score ?? face.box?.score ?? 0.8)).filter(Number.isFinite)
  if (!scores.length) return 0.8
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

function inspectFramePixels(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const sampleWidth = 96
  const sampleHeight = Math.max(54, Math.round((video.videoHeight / Math.max(1, video.videoWidth)) * sampleWidth))
  canvas.width = sampleWidth
  canvas.height = sampleHeight
  const context = canvas.getContext('2d')
  if (!context) return { isCovered: false, confidence: 0 }
  context.drawImage(video, 0, 0, sampleWidth, sampleHeight)
  const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight)
  let sum = 0
  let sumSquares = 0
  for (let index = 0; index < data.length; index += 4) {
    const luminance = (0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]) / 255
    sum += luminance
    sumSquares += luminance * luminance
  }
  const count = data.length / 4
  const mean = sum / count
  const variance = Math.max(0, sumSquares / count - mean * mean)
  const contrast = Math.sqrt(variance)
  const isCovered = mean < 0.08 || (mean < 0.16 && contrast < 0.035)
  return { isCovered, confidence: isCovered ? Math.min(0.98, 1 - mean + (0.08 - Math.min(0.08, contrast))) : 0.4 }
}

function faceBox(face: any) {
  const box = face.box || face.boundingBox
  if (!box) return null
  const x = Number(box.xMin ?? box.x ?? box.topLeft?.[0] ?? 0)
  const y = Number(box.yMin ?? box.y ?? box.topLeft?.[1] ?? 0)
  const width = Number(box.width ?? ((box.xMax ?? box.bottomRight?.[0] ?? 0) - x))
  const height = Number(box.height ?? ((box.yMax ?? box.bottomRight?.[1] ?? 0) - y))
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

function runtimeImport(specifier: string): Promise<any> {
  return new Function('specifier', 'return import(specifier)')(specifier)
}
