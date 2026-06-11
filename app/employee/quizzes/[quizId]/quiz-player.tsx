'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { MonochromeOrb } from '@/components/insights/monochrome-orb'
import { ReadinessMeter } from '@/components/insights/readiness-meter'
import { ViolationToast, type ViolationToastItem } from '@/components/employee/ViolationToast'
import { startQuizAttempt, submitQuizAttempt } from '@/lib/actions/employee'
import { shiftDifficulty } from '@/lib/insights'
import type { DifficultyLevel, ProctoringEvent, ProctoringEventType, ProctoringSubmission, SubmittedQuizAnswer } from '@/lib/types/database'
import type { CameraVisibilityCheck, ReferenceFaceCapture } from '@/lib/proctoring-vision'
import {
  calculateProctoringRisk,
  getProctoringEventRisk,
  getProctoringRiskLevel,
  type ProctoringEventPostPayload,
  PROCTORING_CRITICAL_RISK_SCORE,
  PROCTORING_VIOLATION_LIMIT,
} from '@/lib/proctoring'
import {
  Camera,
  Brain,
  CheckCircle2,
  Clock,
  Eye,
  LockKeyhole,
  Mic,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react'

interface QuizPlayerProps {
  quiz: any
}

type QuizOption = {
  text: string
  optionId: number
}

type QuizQuestion = {
  id: string
  question_text: string
  difficulty: DifficultyLevel
  explanation?: string | null
  options: QuizOption[]
}

type LiveState = {
  cognitiveLoad: boolean
  panicMode: boolean
  cooldownSuggested: boolean
  adaptiveDifficulty: DifficultyLevel
  message: string
}

type DeviceKind = 'camera' | 'microphone'
type DeviceStatus = 'required' | 'checking' | 'granted' | 'denied' | 'missing' | 'busy' | 'unsupported' | 'insecure' | 'error'

type DevicePermission = {
  status: DeviceStatus
  message: string | null
  permissionState: PermissionState | 'unsupported' | null
}

type PermissionDebugState = {
  secureContext: boolean | null
  mediaDevicesExists: boolean
  cameraPermissionState: PermissionState | 'unsupported' | null
  microphonePermissionState: PermissionState | 'unsupported' | null
  lastGetUserMediaCallAt: string | null
  lastGetUserMediaErrorName: string | null
  lastGetUserMediaErrorMessage: string | null
  activeVideoTrackCount: number
  activeAudioTrackCount: number
}

type BrowserCapabilities = {
  secureContext: boolean | null
  mediaDevicesExists: boolean
  fullscreenSupported: boolean
}

type WarningModalState = {
  id: string
  type: ProctoringEventType
  label: string
  createdAt: number
} | null

type CameraVisibilityState = CameraVisibilityCheck
type ProctoringViolationDetails = {
  confidence?: number | null
  detectedCount?: number | null
  objectLabel?: string | null
  metadata?: Record<string, unknown> | null
  evidenceImage?: string | null
}

const initialDevicePermission: DevicePermission = {
  status: 'required',
  message: null,
  permissionState: null,
}

const initialPermissionDebugState: PermissionDebugState = {
  secureContext: null,
  mediaDevicesExists: false,
  cameraPermissionState: null,
  microphonePermissionState: null,
  lastGetUserMediaCallAt: null,
  lastGetUserMediaErrorName: null,
  lastGetUserMediaErrorMessage: null,
  activeVideoTrackCount: 0,
  activeAudioTrackCount: 0,
}

const initialBrowserCapabilities: BrowserCapabilities = {
  secureContext: null,
  mediaDevicesExists: false,
  fullscreenSupported: false,
}

export function QuizPlayer({ quiz }: QuizPlayerProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [started, setStarted] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [questionOrder, setQuestionOrder] = useState<string[]>(
    (quiz.questions || []).map((question: any) => question.id)
  )
  const [answers, setAnswers] = useState<SubmittedQuizAnswer[]>([])
  const answersRef = useRef<SubmittedQuizAnswer[]>([])
  useEffect(() => {
    answersRef.current = answers
  }, [answers])
  const [attemptId, setAttemptId] = useState<string | null>(null)

  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [totalTime, setTotalTime] = useState(0)
  const totalTimeRef = useRef(0)
  useEffect(() => {
    totalTimeRef.current = totalTime
  }, [totalTime])

  const [questionStartTime, setQuestionStartTime] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(quiz.time_limit_minutes * 60)
  const [finished, setFinished] = useState(false)
  const finishedRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [liveState, setLiveState] = useState<LiveState>({
    cognitiveLoad: false,
    panicMode: false,
    cooldownSuggested: false,
    adaptiveDifficulty: quiz.insights?.suggestedNextDifficulty || quiz.difficulty || 'medium',
    message: 'System is tracking rhythm, hesitation, and topic pressure in real time.',
  })
  const requiresProctoring = quiz.proctoring_required !== false
  const microphoneRequired = requiresProctoring && quiz.microphone_required !== false
  const [cameraPermission, setCameraPermission] = useState<DevicePermission>(initialDevicePermission)
  const [microphonePermission, setMicrophonePermission] = useState<DevicePermission>(initialDevicePermission)
  const [cameraVisibility, setCameraVisibility] = useState<CameraVisibilityState>({
    status: 'checking',
    message: 'Run camera test before starting.',
    confidence: 0,
  })
  const [permissionDebug, setPermissionDebug] = useState<PermissionDebugState>(initialPermissionDebugState)
  const [browserCapabilities, setBrowserCapabilities] = useState<BrowserCapabilities>(initialBrowserCapabilities)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  const [riskScore, setRiskScore] = useState(0)
  const [latestViolation, setLatestViolation] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const autoStartedCameraRef = useRef(false)
  const proctoringEventsRef = useRef<ProctoringEvent[]>([])
  const violationCountRef = useRef(0)
  const proctoringSessionIdRef = useRef<string | null>(null)
  const attemptIdRef = useRef<string | null>(null)
  const submittingRef = useRef(false)
  const activeSignalRef = useRef<Record<string, boolean>>({})
  const lastProctoringEventAtRef = useRef<Record<string, number>>({})
  const proctoringEventRetryQueueRef = useRef<ProctoringEventPostPayload[]>([])
  const referenceCaptureRef = useRef<ReferenceFaceCapture | null>(null)
  const answerAdvanceTimerRef = useRef<number | null>(null)
  const latestViolationClearTimerRef = useRef<number | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [draftStorageWarning, setDraftStorageWarning] = useState(false)
  const [violationToasts, setViolationToasts] = useState<ViolationToastItem[]>([])
  const [warningModal, setWarningModal] = useState<WarningModalState>(null)
  const [recentViolations, setRecentViolations] = useState<ProctoringEvent[]>([])
  const [multipleFacesAlertAt, setMultipleFacesAlertAt] = useState<number | null>(null)
  const [referencePhotoUrl, setReferencePhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!multipleFacesAlertAt) return
    const timer = window.setTimeout(() => setMultipleFacesAlertAt(null), 30_000)
    return () => window.clearTimeout(timer)
  }, [multipleFacesAlertAt])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => () => {
    if (latestViolationClearTimerRef.current) window.clearTimeout(latestViolationClearTimerRef.current)
  }, [])

  const questions = (quiz.questions || []) as QuizQuestion[]
  const questionMap = new Map<string, QuizQuestion>(questions.map((question) => [question.id, question]))
  const currentQuestion = questionMap.get(questionOrder[currentIndex])
  const totalQuestions = questions.length
  const progress = totalQuestions > 0 ? ((currentIndex + (showFeedback ? 1 : 0)) / totalQuestions) * 100 : 0
  const readiness = quiz.insights?.readiness
  const isAdminViewer = ['admin', 'manager', 'training_coordinator'].includes(quiz.viewerRole || quiz.currentUserRole || '')
  const showPermissionDebug = process.env.NODE_ENV === 'development' || isAdminViewer
  const cameraReady = cameraPermission.status === 'granted'
  const cameraFrameReady = !requiresProctoring || cameraVisibility.status === 'visible'
  const microphoneReady = microphonePermission.status === 'granted'
  const browserCompatibilityValid = Boolean(browserCapabilities.secureContext && browserCapabilities.mediaDevicesExists)
  const browserCompatibilityMessage = browserCapabilities.secureContext === null
    ? 'Checking browser support'
    : browserCompatibilityValid
      ? 'Ready'
      : !browserCapabilities.secureContext
        ? 'HTTPS or localhost required'
        : 'Media capture unsupported'
  const fullscreenReady = !requiresProctoring || browserCapabilities.fullscreenSupported
  const draftKey = attemptId ? `quiz-draft:${quiz.id}:${attemptId}` : null
  const canStartQuiz = !isPending
    && (!requiresProctoring || (
      cameraReady
      && cameraFrameReady
      && (!microphoneRequired || microphoneReady)
      && fullscreenReady
      && consentAccepted
      && browserCompatibilityValid
    ))

  const logPermissionDebug = useCallback((message: string, details?: unknown) => {
    if (process.env.NODE_ENV !== 'development') return
    if (details === undefined) console.log(`[proctoring] ${message}`)
    else console.log(`[proctoring] ${message}`, details)
  }, [])

  const safeGetLocalStorage = useCallback((key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }, [])

  const safeSetLocalStorage = useCallback((key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      setDraftStorageWarning(true)
    }
  }, [])

  const safeRemoveLocalStorage = useCallback((key: string) => {
    try {
      localStorage.removeItem(key)
    } catch {
      setDraftStorageWarning(true)
    }
  }, [])

  const cleanupStaleDrafts = useCallback((currentAttemptId: string | null) => {
    if (!currentAttemptId) return
    try {
      const prefix = `quiz-draft:${quiz.id}:`
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index)
        if (key?.startsWith(prefix) && key !== `${prefix}${currentAttemptId}`) {
          localStorage.removeItem(key)
        }
      }
    } catch {
      setDraftStorageWarning(true)
    }
  }, [quiz.id])

  const recoverSubmitError = useCallback((message: string) => {
    submittingRef.current = false
    finishedRef.current = false
    setSubmitting(false)
    setFinished(false)
    setSubmitError(message)
  }, [])

  const getActiveTrackCounts = useCallback(() => {
    const stream = mediaStreamRef.current
    return {
      activeVideoTrackCount: stream?.getVideoTracks().filter((track) => track.readyState === 'live').length || 0,
      activeAudioTrackCount: stream?.getAudioTracks().filter((track) => track.readyState === 'live').length || 0,
    }
  }, [])

  const updatePermissionDebug = useCallback((patch: Partial<PermissionDebugState> = {}) => {
    setPermissionDebug((previous) => ({
      ...previous,
      secureContext: typeof window === 'undefined' ? previous.secureContext : window.isSecureContext,
      mediaDevicesExists: typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
      ...getActiveTrackCounts(),
      ...patch,
    }))
  }, [getActiveTrackCounts])

  const stopMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraVisibility({
      status: 'checking',
      message: 'Run camera test before starting.',
      confidence: 0,
    })
    setPermissionDebug((previous) => ({
      ...previous,
      activeVideoTrackCount: 0,
      activeAudioTrackCount: 0,
    }))
  }, [])

  const verifyCameraVisibility = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current || hiddenCanvasRef.current
    if (!video || !canvas) {
      setCameraVisibility({
        status: 'checking',
        message: 'Waiting for camera preview.',
        confidence: 0.1,
      })
      return false
    }

    setCameraVisibility((previous) => ({
      ...previous,
      status: 'model_loading',
      message: 'Loading AI proctoring model...',
    }))

    try {
      const hasLiveFrame = await waitForLiveVideoFrame(video)
      if (!hasLiveFrame) {
        setCameraVisibility({
          status: 'checking',
          message: 'Waiting for a live camera frame.',
          confidence: 0.2,
        })
        return false
      }

      const { validateCameraFrameForProctoring } = await import('@/lib/proctoring-vision')
      const result = await validateCameraFrameForProctoring(video, canvas)
      setCameraVisibility(result)
      return result.status === 'visible'
    } catch {
      setCameraVisibility({
        status: 'unsupported',
        message: 'Camera visibility check failed. Retry camera test before starting.',
        confidence: 0,
      })
      return false
    }
  }, [])

  const buildProctoringSubmission = useCallback((autoSubmitted: boolean, extraEvents: ProctoringEvent[] = []): ProctoringSubmission => ({
    enabled: true,
    sessionId: proctoringSessionIdRef.current || undefined,
    violationCount: Math.max(violationCountRef.current, violationCount),
    riskScore: calculateProctoringRisk([...proctoringEventsRef.current, ...extraEvents]).score,
    riskLevel: calculateProctoringRisk([...proctoringEventsRef.current, ...extraEvents]).level,
    autoSubmitted,
    events: [...proctoringEventsRef.current, ...extraEvents].slice(-50),
  }), [violationCount])

  const flushProctoringEventQueue = useCallback(async () => {
    if (proctoringEventRetryQueueRef.current.length === 0) return null
    const queuedEvents = [...proctoringEventRetryQueueRef.current]

    try {
      const response = await fetch('/api/proctoring/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queuedEvents),
      })
      if (!response.ok) throw new Error('Unable to flush queued proctoring events.')
      const summary = await response.json()
      proctoringEventRetryQueueRef.current = []
      return summary
    } catch {
      proctoringEventRetryQueueRef.current = queuedEvents
      return null
    }
  }, [])

  const enqueueProctoringEvent = useCallback((payload: ProctoringEventPostPayload) => {
    proctoringEventRetryQueueRef.current = [...proctoringEventRetryQueueRef.current, payload].slice(-50)
  }, [])

  const getFinalAnswersForSubmit = useCallback(() => {
    if (selectedOption === null || !currentQuestion || showFeedback) return answersRef.current
    if (answersRef.current.some((answer) => answer.questionId === currentQuestion.id)) return answersRef.current

    const selectedOriginalOption = currentQuestion.options[selectedOption]?.optionId
    if (selectedOriginalOption === undefined) return answersRef.current

    return [
      ...answersRef.current,
      {
        questionId: currentQuestion.id,
        selectedOption: selectedOriginalOption,
        timeSpent: Math.max(0, Math.round((Date.now() - questionStartTime) / 1000)),
        questionDifficulty: currentQuestion.difficulty,
      },
    ]
  }, [currentQuestion, questionStartTime, selectedOption, showFeedback])

  const doSubmit = useCallback((finalAnswers: SubmittedQuizAnswer[], proctoring?: ProctoringSubmission) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setSubmitError(null)
    stopMediaStream()
    startTransition(async () => {
      try {
        if (requiresProctoring) {
          await flushProctoringEventQueue()
        }

        const result = await submitQuizAttempt({
          quiz_id: quiz.id,
          answers: finalAnswers,
          time_taken_seconds: totalTimeRef.current,
          proctoring: requiresProctoring ? (proctoring || buildProctoringSubmission(false)) : undefined,
        })

        if (result.error) {
          recoverSubmitError(result.error ?? 'Submission failed. Please try again.')
          return
        }

        if (draftKey) safeRemoveLocalStorage(draftKey)
        router.push(`/employee/quizzes/${quiz.id}/results`)
      } catch {
        recoverSubmitError('Network error while submitting. Please check your connection and try again.')
      }
    })
  }, [buildProctoringSubmission, draftKey, flushProctoringEventQueue, quiz.id, recoverSubmitError, requiresProctoring, router, safeRemoveLocalStorage, startTransition, stopMediaStream])

  useEffect(() => {
    if (!draftKey) return
    const saved = safeGetLocalStorage(draftKey)
    if (!saved) return

    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) setAnswers(parsed)
    } catch {
      safeRemoveLocalStorage(draftKey)
    }
  }, [draftKey, safeGetLocalStorage, safeRemoveLocalStorage])

  useEffect(() => {
    if (!draftKey || answers.length === 0) return
    safeSetLocalStorage(draftKey, JSON.stringify(answers))
  }, [answers, draftKey, safeSetLocalStorage])

  const captureEvidenceFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = hiddenCanvasRef.current || canvasRef.current
    if (!video || !canvas || video.readyState < 2) return null

    const width = video.videoWidth || 320
    const height = video.videoHeight || 240
    const scale = Math.min(800 / width, 600 / height, 1)
    const targetWidth = Math.max(1, Math.round(width * scale))
    const targetHeight = Math.max(1, Math.round(height * scale))
    canvas.width = targetWidth
    canvas.height = targetHeight
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(video, 0, 0, targetWidth, targetHeight)
    let quality = 0.7
    let dataUrl = canvas.toDataURL('image/jpeg', quality)
    while (dataUrl.length > 1_100_000 && quality > 0.35) {
      quality -= 0.08
      dataUrl = canvas.toDataURL('image/jpeg', quality)
    }
    return dataUrl
  }, [])

  const handleAutoSubmit = useCallback((proctoring?: ProctoringSubmission) => {
    if (!finishedRef.current) {
      finishedRef.current = true
      setFinished(true)
      doSubmit(getFinalAnswersForSubmit(), proctoring || buildProctoringSubmission(true))
    }
  }, [buildProctoringSubmission, doSubmit, getFinalAnswersForSubmit])

  const recordProctoringViolation = useCallback((type: ProctoringEventType, label: string, details: ProctoringViolationDetails = {}) => {
    if (!requiresProctoring || !started || finishedRef.current || submittingRef.current) return

    const now = Date.now()
    const dedupeWindowMs = getProctoringDedupeWindowMs(type)
    const lastRecordedAt = lastProctoringEventAtRef.current[type] || 0
    if (now - lastRecordedAt < dedupeWindowMs) return
    lastProctoringEventAtRef.current[type] = now

    setLatestViolation(label)
    if (latestViolationClearTimerRef.current) window.clearTimeout(latestViolationClearTimerRef.current)
    latestViolationClearTimerRef.current = window.setTimeout(() => {
      setLatestViolation(null)
      latestViolationClearTimerRef.current = null
    }, getProctoringWarningSafeClearMs(type))
    if (type === 'multiple_faces') setMultipleFacesAlertAt(now)
    const toastId = `${type}-${now}-${Math.random().toString(36).slice(2)}`
    setWarningModal({ id: toastId, type, label, createdAt: now })
    setViolationToasts((previous) => [
      { id: toastId, type, label },
      ...previous.filter((item) => item.id !== toastId),
    ].slice(0, 3))

    const event: ProctoringEvent = {
      type,
      label,
      occurredAt: new Date().toISOString(),
      questionIndex: currentIndex,
      riskScore: getProctoringEventRisk(type),
      riskLevel: getProctoringRiskLevel(getProctoringEventRisk(type)),
      confidence: details.confidence ?? null,
      detectedCount: details.detectedCount ?? null,
      objectLabel: details.objectLabel ?? null,
      metadata: details.metadata ?? null,
    }
    proctoringEventsRef.current = [...proctoringEventsRef.current, event].slice(-50)
    setRecentViolations((previous) => [event, ...previous].slice(0, 8))

    const sessionId = proctoringSessionIdRef.current
    const attemptId = attemptIdRef.current
    if (!sessionId || !attemptId) return

    const payload: ProctoringEventPostPayload = {
      sessionId,
      attemptId,
      type,
      label,
      questionIndex: currentIndex,
      confidence: details.confidence ?? null,
      detectedCount: details.detectedCount ?? null,
      objectLabel: details.objectLabel ?? null,
      metadata: details.metadata ?? null,
      evidenceImage: details.evidenceImage || captureEvidenceFrame(),
    }

    void flushProctoringEventQueue()
      .then(() => fetch('/api/proctoring/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }))
      .then(async (response) => {
        if (!response.ok) {
          enqueueProctoringEvent(payload)
          return null
        }
        return response.json()
      })
      .then((summary) => {
        if (!summary) return
        violationCountRef.current = summary.violationCount
        setViolationCount(summary.violationCount)
        setRiskScore(summary.riskScore)

        if (summary.autoSubmit) {
          const autoSubmitEvent: ProctoringEvent = {
            type: 'auto-submit',
            label: summary.riskScore > PROCTORING_CRITICAL_RISK_SCORE
              ? 'Critical integrity risk reached. Quiz auto-submitted and employee flagged.'
              : 'Violation limit reached. Quiz auto-submitted and employee flagged.',
            occurredAt: new Date().toISOString(),
            questionIndex: currentIndex,
            riskScore: 0,
            riskLevel: summary.riskLevel,
          }
          const finalEvents = [...proctoringEventsRef.current, autoSubmitEvent].slice(-50)
          proctoringEventsRef.current = finalEvents
          handleAutoSubmit({
            enabled: true,
            sessionId,
            violationCount: summary.violationCount,
            riskScore: summary.riskScore,
            riskLevel: summary.riskLevel,
            autoSubmitted: true,
            events: finalEvents,
          })
        }
      })
      .catch(() => {
        enqueueProctoringEvent(payload)
        setLatestViolation(`${label} Server sync failed; keep the quiz window stable.`)
      })
  }, [captureEvidenceFrame, currentIndex, enqueueProctoringEvent, flushProctoringEventQueue, handleAutoSubmit, requiresProctoring, started])

  useEffect(() => {
    if (!requiresProctoring || !started || finished || !videoRef.current || !hiddenCanvasRef.current) return
    let disposed = false
    let stopVision: ((videoElement?: HTMLVideoElement | null) => void) | null = null
    const videoElement = videoRef.current
    const canvasElement = hiddenCanvasRef.current

    void import('@/lib/proctoring-vision')
      .then((vision) => {
        if (disposed) return
        stopVision = vision.stopVisionProctoring
        vision.startVisionProctoring({
          videoElement,
          canvasElement,
          intervalMs: 1500,
          requireFullscreen: true,
          referenceCapture: referenceCaptureRef.current ?? undefined,
          onViolation: (violation) => {
            const type = visionViolationTypeToEventType(violation.type)
            recordProctoringViolation(type, violation.label, {
              confidence: violation.confidence,
              detectedCount: violation.detectedCount,
              objectLabel: violation.objectLabel,
              metadata: violation.metadata,
              evidenceImage: violation.evidenceDataUrl,
            })
          },
        })
      })
      .catch((error) => {
        console.warn('[proctoring] advanced vision failed open:', error)
      })

    return () => {
      disposed = true
      stopVision?.(videoElement)
    }
  }, [finished, recordProctoringViolation, requiresProctoring, started])

  useEffect(() => {
    if (!requiresProctoring || started || !cameraReady || !mediaStreamRef.current) return
    let disposed = false
    const tick = async () => {
      if (disposed) return
      await verifyCameraVisibility()
    }
    void tick()
    const intervalId = window.setInterval(tick, 2500)
    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [cameraReady, requiresProctoring, started, verifyCameraVisibility])

  useEffect(() => {
    if (!started || finished) return
    const interval = setInterval(() => {
      if (quiz.time_limit_minutes > 0) {
        setTimeRemaining((previous: number) => {
          if (previous <= 1) {
            clearInterval(interval)
            handleAutoSubmit(requiresProctoring ? buildProctoringSubmission(false) : undefined)
            return 0
          }
          return previous - 1
        })
      }
      setTotalTime((previous) => previous + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [started, finished, quiz.time_limit_minutes, handleAutoSubmit, buildProctoringSubmission, requiresProctoring])

  const deviceErrorMessage = useCallback((kind: DeviceKind, error: unknown) => {
    const deviceLabel = kind === 'camera' ? 'Camera' : 'Microphone'
    const name = error instanceof DOMException ? error.name : ''
    const message = error instanceof Error ? error.message : String(error || '')
    console.log(name, message)
    logPermissionDebug(`${kind} getUserMedia error`, { name, message })

    switch (name) {
      case 'NotAllowedError':
        return {
          status: 'denied' as DeviceStatus,
          message: `${deviceLabel} permission was denied. Use Retry ${deviceLabel} Permission after allowing access in your browser settings.`,
        }
      case 'NotFoundError':
        return {
          status: 'missing' as DeviceStatus,
          message: `${deviceLabel === 'Camera' ? 'No camera' : 'No microphone'} was found on this device.`,
        }
      case 'NotReadableError':
        return {
          status: 'busy' as DeviceStatus,
          message: `${deviceLabel} is already in use by another app or browser tab.`,
        }
      case 'OverconstrainedError':
        return {
          status: 'error' as DeviceStatus,
          message: `${deviceLabel} does not support the requested constraints.`,
        }
      case 'SecurityError':
        return {
          status: 'insecure' as DeviceStatus,
          message: `${deviceLabel} access is blocked by browser security settings. Camera access requires HTTPS or localhost.`,
        }
      default:
        return {
          status: 'error' as DeviceStatus,
          message: `${deviceLabel} access failed${message ? `: ${message}` : '.'}`,
        }
    }
  }, [logPermissionDebug])

  const requestDevicePermission = useCallback(async (kind: DeviceKind) => {
    const setPermission = kind === 'camera' ? setCameraPermission : setMicrophonePermission
    const constraints = kind === 'camera' ? { video: true } : { audio: true }

    if (!window.isSecureContext) {
      setPermission({
        status: 'insecure',
        message: 'Camera access requires HTTPS or localhost.',
        permissionState: null,
      })
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission({
        status: 'unsupported',
        message: kind === 'camera'
          ? 'This browser does not support camera access.'
          : 'This browser does not support microphone access.',
        permissionState: null,
      })
      return
    }

    setPermission((previous) => ({ ...previous, status: 'checking', message: null }))
    updatePermissionDebug({
      lastGetUserMediaCallAt: new Date().toISOString(),
      lastGetUserMediaErrorName: null,
      lastGetUserMediaErrorMessage: null,
    })
    console.log(`requesting ${kind === 'camera' ? 'camera' : 'microphone'}`)
    logPermissionDebug(`${kind} getUserMedia requested`, constraints)

    try {
      if (kind === 'camera') stopMediaStream()
      const stream = kind === 'camera'
        ? await navigator.mediaDevices.getUserMedia({ video: true })
        : await navigator.mediaDevices.getUserMedia({ audio: true })
      if (kind === 'camera') console.log('camera granted', stream)
      else console.log('microphone granted', stream)
      const tracks = kind === 'camera' ? stream.getVideoTracks() : stream.getAudioTracks()
      const liveTrack = tracks.find((track) => track.readyState === 'live')

      if (!liveTrack) {
        stream.getTracks().forEach((track) => track.stop())
        setPermission({
          status: 'error',
          message: kind === 'camera' ? 'Camera permission succeeded, but no live video track started.' : 'Microphone permission succeeded, but no live audio track started.',
          permissionState: null,
        })
        return
      }

      if (kind === 'camera') {
        mediaStreamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => undefined)
        }
      } else {
        stream.getTracks().forEach((track) => track.stop())
      }
      logPermissionDebug(`${kind} getUserMedia success`, { trackCount: tracks.length })
      updatePermissionDebug({
        lastGetUserMediaErrorName: null,
        lastGetUserMediaErrorMessage: null,
        [kind === 'camera' ? 'cameraPermissionState' : 'microphonePermissionState']: 'granted',
        activeVideoTrackCount: kind === 'camera' ? tracks.filter((track) => track.readyState === 'live').length : getActiveTrackCounts().activeVideoTrackCount,
        activeAudioTrackCount: 0,
      })
      setPermission({
        status: 'granted',
        message: kind === 'camera' ? 'Camera permission is granted. Keep your full face visible for verification.' : 'Microphone permission is granted.',
        permissionState: 'granted',
      })
      if (kind === 'camera') void verifyCameraVisibility()
    } catch (error) {
      const result = deviceErrorMessage(kind, error)
      updatePermissionDebug({
        lastGetUserMediaErrorName: error instanceof DOMException ? error.name : error instanceof Error ? error.name : 'UnknownError',
        lastGetUserMediaErrorMessage: error instanceof Error ? error.message : String(error || ''),
      })
      setPermission((previous) => ({
        status: result.status,
        message: result.message,
        permissionState: result.status === 'denied' ? 'denied' : previous.permissionState,
      }))
    }
  }, [deviceErrorMessage, getActiveTrackCounts, logPermissionDebug, stopMediaStream, updatePermissionDebug, verifyCameraVisibility])

  const requestCameraPermission = useCallback(() => {
    autoStartedCameraRef.current = true  // prevent duplicate auto-start after manual click
    return requestDevicePermission('camera')
  }, [requestDevicePermission])

  const requestMicrophonePermission = useCallback(() => {
    return requestDevicePermission('microphone')
  }, [requestDevicePermission])

  const retryProctoringCheck = useCallback(async () => {
    setStartError(null)
    setCameraVisibility({
      status: 'model_loading',
      message: 'Loading AI proctoring model...',
      confidence: 0,
    })

    try {
      const vision = await import('@/lib/proctoring-vision')
      vision.resetProctoringModelCache()
    } catch (error) {
      console.warn('[proctoring] model retry reset failed:', error)
    }

    if (!mediaStreamRef.current || !cameraReady) {
      await requestDevicePermission('camera')
    }
    if (microphoneRequired && !microphoneReady) {
      await requestDevicePermission('microphone')
    }
    await verifyCameraVisibility()
  }, [cameraReady, microphoneReady, microphoneRequired, requestDevicePermission, verifyCameraVisibility])

  const startProctoringMediaStream = useCallback(async () => {
    stopMediaStream()

    if (!navigator.mediaDevices?.getUserMedia) {
      setStartError('This browser does not support camera access.')
      return false
    }

    const stream = new MediaStream()
    let cameraStream: MediaStream | null = null
    let microphoneStream: MediaStream | null = null

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true })
      const videoTracks = cameraStream.getVideoTracks()
      if (!videoTracks.some((track) => track.readyState === 'live')) {
        throw new Error('Camera permission is granted, but no live video track started.')
      }
      videoTracks.forEach((track) => stream.addTrack(track))

      if (microphoneRequired) {
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const audioTracks = microphoneStream.getAudioTracks()
        if (!audioTracks.some((track) => track.readyState === 'live')) {
          throw new Error('Microphone permission is granted, but no live audio track started.')
        }
        audioTracks.forEach((track) => stream.addTrack(track))
      }

      mediaStreamRef.current = stream
      setCameraPermission({
        status: 'granted',
        message: 'Camera stream is active.',
        permissionState: 'granted',
      })
      setMicrophonePermission((previous) => microphoneRequired
        ? {
            status: 'granted',
            message: 'Microphone stream is active.',
            permissionState: 'granted',
          }
        : previous
      )
      updatePermissionDebug({
        cameraPermissionState: 'granted',
        microphonePermissionState: microphoneRequired ? 'granted' : permissionDebug.microphonePermissionState,
        activeVideoTrackCount: stream.getVideoTracks().filter((track) => track.readyState === 'live').length,
        activeAudioTrackCount: stream.getAudioTracks().filter((track) => track.readyState === 'live').length,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      const faceVisible = await verifyCameraVisibility()
      if (!faceVisible) {
        throw new Error(cameraVisibility.message || 'Your full face must be visible before the proctored quiz can start.')
      }
      return true
    } catch (error) {
      cameraStream?.getTracks().forEach((track) => track.stop())
      microphoneStream?.getTracks().forEach((track) => track.stop())
      stream.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
      const message = error instanceof Error ? error.message : 'Unable to start the live proctoring stream.'
      setStartError(message)
      updatePermissionDebug({
        lastGetUserMediaErrorName: error instanceof DOMException ? error.name : error instanceof Error ? error.name : 'UnknownError',
        lastGetUserMediaErrorMessage: message,
        activeVideoTrackCount: 0,
        activeAudioTrackCount: 0,
      })
      return false
    }
  }, [cameraVisibility.message, microphoneRequired, permissionDebug.microphonePermissionState, stopMediaStream, updatePermissionDebug, verifyCameraVisibility])

  async function handleStart() {
    setStartError(null)
    if (!requiresProctoring) {
      startTransition(async () => {
        const result = await startQuizAttempt(quiz.id)
        if (result.error) {
          setStartError(result.error)
          return
        }
        const nextAttemptId = result.data?.id || null
        attemptIdRef.current = nextAttemptId
        setAttemptId(nextAttemptId)
        cleanupStaleDrafts(nextAttemptId)
        setStarted(true)
        setQuestionStartTime(Date.now())
      })
      return
    }
    if (!browserCompatibilityValid) {
      setStartError(!window.isSecureContext ? 'Camera access requires HTTPS or localhost.' : 'This browser does not support camera access.')
      return
    }
    if (!cameraReady) {
      setStartError('Enable camera proctoring before launching the quiz.')
      return
    }
    if (!cameraFrameReady) {
      const faceVisible = await verifyCameraVisibility()
      if (!faceVisible) {
        setStartError(cameraVisibility.message || 'Your full face must be visible before launching the quiz.')
        return
      }
    }
    if (microphoneRequired && !microphoneReady) {
      setStartError('Enable microphone proctoring before launching the quiz.')
      return
    }
    if (!consentAccepted) {
      setStartError('Accept the proctoring consent before launching the quiz.')
      return
    }
    if (!document.documentElement.requestFullscreen) {
      setStartError('Fullscreen mode is not supported by this browser.')
      return
    }
    try {
      await document.documentElement.requestFullscreen()
      if (!document.fullscreenElement) {
        setStartError('Fullscreen is required before launching the proctored quiz. Use the launch button again and allow fullscreen.')
        return
      }
    } catch {
      setStartError('Fullscreen is required before launching the proctored quiz. Your browser blocked the request.')
      return
    }
    const proctoringStreamReady = await startProctoringMediaStream()
    if (!proctoringStreamReady) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined)
      return
    }
    const freshFaceVisible = await verifyCameraVisibility()
    if (!freshFaceVisible) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined)
      setStartError(cameraVisibility.message || 'Exactly one centered face must be visible before launching the quiz.')
      return
    }

    let baselineCapture: ReferenceFaceCapture | null = null
    const baselineCanvas = canvasRef.current || hiddenCanvasRef.current
    if (videoRef.current && baselineCanvas) {
      try {
        const { captureReferenceFace } = await import('@/lib/proctoring-vision')
        baselineCapture = await captureReferenceFace(videoRef.current, baselineCanvas)
      } catch (err) {
        console.warn('[proctoring] reference face capture failed:', err)
      }
    }
    if (!baselineCapture) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined)
      setStartError('Unable to capture a reliable baseline face. Keep exactly one centered face visible in good lighting, then retry.')
      return
    }
    const verifiedBaselineCapture = baselineCapture
    referenceCaptureRef.current = verifiedBaselineCapture
    setReferencePhotoUrl(verifiedBaselineCapture.dataUrl)

    window.history.pushState({ proctoredQuiz: true }, '', window.location.href)
    startTransition(async () => {
      const result = await startQuizAttempt(quiz.id, {
        cameraReady: true,
        microphoneReady,
        fullscreenReady: Boolean(document.fullscreenElement),
        consentAccepted: true,
        baselineFace: {
          capturedAt: new Date(verifiedBaselineCapture.capturedAt).toISOString(),
          faceSignature: verifiedBaselineCapture.faceSignature,
          confidence: verifiedBaselineCapture.faceConfidence,
          metadata: verifiedBaselineCapture.metadata,
        },
      })
      if (result.error) {
        stopMediaStream()
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined)
        setStartError(result.error)
        return
      }
      const nextAttemptId = result.data?.id || null
      attemptIdRef.current = nextAttemptId
      setAttemptId(nextAttemptId)
      cleanupStaleDrafts(nextAttemptId)
      proctoringSessionIdRef.current = result.proctoringSession?.id || null

      setStarted(true)
      setQuestionStartTime(Date.now())
    })
  }

  useEffect(() => {
    if (!requiresProctoring) return
    if (typeof window === 'undefined') return
    const currentCapabilities = {
      secureContext: window.isSecureContext,
      mediaDevicesExists: Boolean(navigator.mediaDevices?.getUserMedia),
      fullscreenSupported: Boolean(document.documentElement.requestFullscreen),
    }
    setBrowserCapabilities(currentCapabilities)
    updatePermissionDebug()

    if (!window.isSecureContext) {
      const insecureState = {
        status: 'insecure' as DeviceStatus,
        message: 'Camera access requires HTTPS or localhost.',
        permissionState: null,
      }
      setCameraPermission(insecureState)
      setMicrophonePermission(insecureState)
      updatePermissionDebug({
        secureContext: false,
        cameraPermissionState: null,
        microphonePermissionState: null,
      })
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraPermission({
        status: 'unsupported',
        message: 'This browser does not support camera access.',
        permissionState: null,
      })
      setMicrophonePermission({
        status: 'unsupported',
        message: 'This browser does not support microphone access.',
        permissionState: null,
      })
      updatePermissionDebug({
        mediaDevicesExists: false,
        cameraPermissionState: null,
        microphonePermissionState: null,
      })
      return
    }

    if (!navigator.permissions?.query) {
      setCameraPermission((previous) => ({ ...previous, permissionState: 'unsupported' }))
      setMicrophonePermission((previous) => ({ ...previous, permissionState: 'unsupported' }))
      updatePermissionDebug({
        cameraPermissionState: 'unsupported',
        microphonePermissionState: 'unsupported',
      })
      return
    }

    let cancelled = false
    const watchedPermissions: PermissionStatus[] = []
    const applyPermissionState = (kind: DeviceKind, state: PermissionState) => {
      logPermissionDebug(`${kind} permission query state`, state)
      updatePermissionDebug({
        [kind === 'camera' ? 'cameraPermissionState' : 'microphonePermissionState']: state,
      })
      const setPermission = kind === 'camera' ? setCameraPermission : setMicrophonePermission
      setPermission((previous) => {
        const liveTrackCount = kind === 'camera'
          ? mediaStreamRef.current?.getVideoTracks().filter((track) => track.readyState === 'live').length || 0
          : mediaStreamRef.current?.getAudioTracks().filter((track) => track.readyState === 'live').length || 0

        if (previous.status === 'granted' && liveTrackCount > 0) return { ...previous, permissionState: state }
        if (state === 'granted') {
          return {
            status: 'granted',
            message: kind === 'camera' ? 'Camera permission is granted.' : 'Microphone permission is granted.',
            permissionState: state,
          }
        }
        if (state === 'denied') {
          const label = kind === 'camera' ? 'Camera' : 'Microphone'
          return {
            status: 'denied',
            message: `${label} permission is blocked. Open Site settings for this page, allow ${kind}, then click Retry ${label} Permission.`,
            permissionState: state,
          }
        }
        return {
          ...previous,
          status: previous.status === 'checking' ? 'checking' : 'required',
          message: previous.status === 'checking' ? previous.message : null,
          permissionState: state,
        }
      })
    }

    const queryPermission = async (kind: DeviceKind, name: PermissionName, attachListener = false) => {
      try {
        const permission = await navigator.permissions.query({ name })
        if (cancelled) return
        const applyState = () => applyPermissionState(kind, permission.state)
        applyState()
        if (attachListener) {
          permission.onchange = () => {
            applyState()
          }
          watchedPermissions.push(permission)
        }
      } catch (error) {
        logPermissionDebug(`${kind} permission query unsupported`, error instanceof Error ? error.message : error)
        const setPermission = kind === 'camera' ? setCameraPermission : setMicrophonePermission
        setPermission((previous) => ({ ...previous, permissionState: 'unsupported' }))
        updatePermissionDebug({
          [kind === 'camera' ? 'cameraPermissionState' : 'microphonePermissionState']: 'unsupported',
        })
      }
    }

    const refreshPermissionStates = () => {
      void queryPermission('camera', 'camera' as PermissionName)
      void queryPermission('microphone', 'microphone' as PermissionName)
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshPermissionStates()
      }
    }

    void queryPermission('camera', 'camera' as PermissionName, true)
    void queryPermission('microphone', 'microphone' as PermissionName, true)
    window.addEventListener('focus', refreshPermissionStates)
    window.addEventListener('pageshow', refreshPermissionStates)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      cancelled = true
      watchedPermissions.forEach((permission) => {
        permission.onchange = null
      })
      window.removeEventListener('focus', refreshPermissionStates)
      window.removeEventListener('pageshow', refreshPermissionStates)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [logPermissionDebug, requiresProctoring, updatePermissionDebug])

  useEffect(() => {
    return () => {
      if (answerAdvanceTimerRef.current) window.clearTimeout(answerAdvanceTimerRef.current)
      stopMediaStream()
    }
  }, [stopMediaStream])

  useEffect(() => {
    if (!cameraReady || !videoRef.current || !mediaStreamRef.current) return
    if (videoRef.current.srcObject !== mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current
      videoRef.current.play().catch(() => undefined)
    }
  }, [cameraReady, started])

  // When browser permission is already granted (e.g. returning for a second quiz),
  // the permission query immediately returns 'granted' but no stream is active yet.
  // Auto-request the camera stream so the preview is not a black screen.
  useEffect(() => {
    if (!requiresProctoring || started || autoStartedCameraRef.current) return
    if (cameraPermission.permissionState === 'granted' && !mediaStreamRef.current) {
      autoStartedCameraRef.current = true
      void requestDevicePermission('camera')
    }
  }, [cameraPermission.permissionState, requestDevicePermission, requiresProctoring, started])

  useEffect(() => {
    if (!requiresProctoring || !started || finished) return

    const onVisibilityChange = () => {
      if (document.hidden) recordProctoringViolation('tab-hidden', 'Quiz tab was hidden or another tab/app was opened.')
    }
    const onBlur = () => recordProctoringViolation('window-blur', 'Quiz window lost focus.')
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) recordProctoringViolation('fullscreen-exit', 'Fullscreen proctoring mode was exited.')
    }
    const onPopState = () => {
      window.history.pushState({ proctoredQuiz: true }, '', window.location.href)
      recordProctoringViolation('back-navigation', 'Back navigation was attempted during the quiz.')
    }
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      recordProctoringViolation('context-menu', 'Context menu was opened during the quiz.')
    }
    const onCopy = (event: ClipboardEvent) => {
      event.preventDefault()
      recordProctoringViolation('copy-attempt', 'Copy action was attempted during the quiz.')
    }
    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault()
      recordProctoringViolation('paste-attempt', 'Paste action was attempted during the quiz.')
    }
    const onCut = (event: ClipboardEvent) => {
      event.preventDefault()
      recordProctoringViolation('copy-attempt', 'Cut action was attempted during the quiz.')
    }
    const onSelectStart = (event: Event) => {
      event.preventDefault()
      recordProctoringViolation('copy-attempt', 'Text selection was attempted during the quiz.')
    }
    const onDragOrDrop = (event: DragEvent) => {
      event.preventDefault()
      recordProctoringViolation('blocked-shortcut', 'Drag or drop activity was attempted during the quiz.')
    }
    const onBeforePrint = () => recordProctoringViolation('blocked-shortcut', 'Print was attempted during the quiz.')
    const onOffline = () => recordProctoringViolation('network-offline', 'Network connection went offline during the quiz.')
    let lastActivityAt = Date.now()
    const onActivity = () => {
      lastActivityAt = Date.now()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const blocked = event.metaKey || event.ctrlKey || event.altKey || key === 'f11' || key === 'printscreen'
      if (!blocked) return
      event.preventDefault()
      recordProctoringViolation('blocked-shortcut', `Blocked restricted keyboard shortcut: ${event.key}.`)
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
      recordProctoringViolation('tab-hidden', 'Attempted to close or reload the quiz tab.')
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    window.addEventListener('popstate', onPopState)
    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCut)
    document.addEventListener('paste', onPaste)
    document.addEventListener('selectstart', onSelectStart)
    document.addEventListener('dragstart', onDragOrDrop)
    document.addEventListener('drop', onDragOrDrop)
    document.addEventListener('mousemove', onActivity)
    document.addEventListener('keydown', onActivity)
    document.addEventListener('click', onActivity)
    window.addEventListener('offline', onOffline)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('beforeprint', onBeforePrint)

    const tracks = mediaStreamRef.current?.getTracks() || []
    const onMediaTrackEnded = () => recordProctoringViolation('camera-lost', 'Proctoring media stream stopped during the quiz.')
    tracks.forEach((track) => track.addEventListener('ended', onMediaTrackEnded))
    const reportSignalOnce = (key: string, type: ProctoringEventType, label: string, active: boolean) => {
      if (active && !activeSignalRef.current[key]) {
        activeSignalRef.current[key] = true
        recordProctoringViolation(type, label)
      }
      if (!active) activeSignalRef.current[key] = false
    }
    const devtoolsInterval = window.setInterval(() => {
      const likelyOpen = (window.outerWidth - window.innerWidth > 180) || (window.outerHeight - window.innerHeight > 180)
      reportSignalOnce('devtoolsOpen', 'devtools-open', 'Developer tools or inspection panel may have been opened.', likelyOpen)
    }, 8000)
    const integrityInterval = window.setInterval(() => {
      reportSignalOnce('hiddenPoll', 'tab-hidden', 'Quiz tab is hidden or another tab/app is active.', document.hidden)
      reportSignalOnce('focusPoll', 'window-blur', 'Quiz window is not focused.', !document.hasFocus())
      reportSignalOnce('fullscreenPoll', 'fullscreen-exit', 'Fullscreen proctoring mode is not active.', !document.fullscreenElement)
      const liveVideo = mediaStreamRef.current?.getVideoTracks().some((track) => track.readyState === 'live') || false
      reportSignalOnce('cameraLivePoll', 'camera-lost', 'Camera stream is not live during the quiz.', !liveVideo)
      const liveAudio = !microphoneRequired || Boolean(mediaStreamRef.current?.getAudioTracks().some((track) => track.readyState === 'live'))
      reportSignalOnce('microphoneLivePoll', 'microphone-denied', 'Microphone stream is not live during the quiz.', !liveAudio)
      reportSignalOnce('longInactivity', 'blocked-shortcut', 'No exam activity detected for an extended period.', Date.now() - lastActivityAt > 45_000)
    }, 1500)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCut)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('selectstart', onSelectStart)
      document.removeEventListener('dragstart', onDragOrDrop)
      document.removeEventListener('drop', onDragOrDrop)
      document.removeEventListener('mousemove', onActivity)
      document.removeEventListener('keydown', onActivity)
      document.removeEventListener('click', onActivity)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('beforeprint', onBeforePrint)
      tracks.forEach((track) => track.removeEventListener('ended', onMediaTrackEnded))
      window.clearInterval(devtoolsInterval)
      window.clearInterval(integrityInterval)
    }
  }, [finished, microphoneRequired, recordProctoringViolation, requiresProctoring, started])

  function buildAdaptiveOrder(targetDifficulty: DifficultyLevel) {
    const completedIds = new Set(questionOrder.slice(0, currentIndex + 1))
    const remaining = questions.filter((question) => !completedIds.has(question.id))
    remaining.sort((left, right) => {
      const leftDistance = Math.abs(difficultyValue(left.difficulty) - difficultyValue(targetDifficulty))
      const rightDistance = Math.abs(difficultyValue(right.difficulty) - difficultyValue(targetDifficulty))
      return leftDistance - rightDistance
    })

    setQuestionOrder([
      ...questionOrder.slice(0, currentIndex + 1),
      ...remaining.map((question) => question.id),
    ])
  }

  function handleSelectOption(optionIndex: number) {
    if (showFeedback || finished || submitting || !currentQuestion) return

    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000)
    const questionDifficulty = (currentQuestion.difficulty || quiz.difficulty || 'medium') as DifficultyLevel
    const cognitiveLoadFlag = questionDifficulty === 'easy' && timeSpent > 15
    const panicSignal = false
    const panicMode = false
    const adaptiveDifficulty = quiz.insights?.antiGamingDetected
      ? shiftDifficulty(questionDifficulty, 1)
      : cognitiveLoadFlag
        ? shiftDifficulty(questionDifficulty, -1)
        : shiftDifficulty(questionDifficulty, 1)
    const selectedOriginalOption = currentQuestion.options[optionIndex]?.optionId

    if (selectedOriginalOption === undefined) return

    const answer: SubmittedQuizAnswer = {
      questionId: currentQuestion.id,
      selectedOption: selectedOriginalOption,
      timeSpent,
      questionDifficulty,
      cognitiveLoadFlag,
      panicSignal,
      adaptiveDifficulty,
    }

    const cooldownSuggested = panicMode || cognitiveLoadFlag
    const nextAnswers = [...answersRef.current, answer]

    answersRef.current = nextAnswers
    setAnswers(nextAnswers)
    setSelectedOption(optionIndex)
    setShowFeedback(true)
    setLiveState({
      cognitiveLoad: cognitiveLoadFlag,
      panicMode,
      cooldownSuggested,
      adaptiveDifficulty,
      message: quiz.insights?.antiGamingDetected
        ? 'Challenge mode is active. The next batch is moving up a notch.'
        : cooldownSuggested
          ? 'Behavioral AI suggests a short breath reset before the next question.'
          : 'Stable rhythm detected. The next question is being tuned upward in real time.',
    })
    buildAdaptiveOrder(adaptiveDifficulty)

    if (currentIndex + 1 >= totalQuestions) {
      answerAdvanceTimerRef.current = window.setTimeout(() => {
        finishedRef.current = true
        setFinished(true)
        doSubmit(nextAnswers, requiresProctoring ? buildProctoringSubmission(false) : undefined)
      }, 300)
      return
    }

    answerAdvanceTimerRef.current = window.setTimeout(() => {
      setCurrentIndex((previous) => previous + 1)
      setSelectedOption(null)
      setShowFeedback(false)
      setQuestionStartTime(Date.now())
    }, 300)
  }

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const remainder = seconds % 60
    return `${minutes}:${remainder.toString().padStart(2, '0')}`
  }

  if (!mounted) return null

  if (!started) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card className="overflow-hidden border-zinc-800 bg-black text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
          <div className="grid gap-8 p-8 md:grid-cols-[1.1fr_0.9fr] md:p-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.35em] text-zinc-400">
                <Sparkles className="h-3.5 w-3.5" />
                Adaptive SkillTest_AI Session
              </div>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{quiz.title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
                  {quiz.description || quiz.topic}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard label="Questions" value={`${totalQuestions}`} />
                <MetricCard label="Minutes" value={`${quiz.time_limit_minutes}`} />
                <MetricCard label="Mode" value={quiz.insights?.antiGamingDetected ? 'Challenge' : 'Adaptive'} />
              </div>

              <div className="grid gap-3">
                {requiresProctoring ? (
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                    <div className="flex items-start gap-3">
                      <LockKeyhole className="mt-0.5 h-5 w-5 text-white" />
                      <div>
                        <p className="font-medium text-white">AI camera proctoring required</p>
                        <p className="mt-1 text-zinc-400">
                          Keep this tab focused, stay in fullscreen, and keep your camera frame visible. Three verified warnings or critical risk auto-submit the test and notify staff with captured proof.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                    <p className="font-medium text-white">Standard quiz mode</p>
                    <p className="mt-1 text-zinc-400">This quiz does not require camera, microphone, or fullscreen proctoring checks.</p>
                  </div>
                )}

                {quiz.insights?.retentionCheck?.daysSinceLastAssessment >= 14 && (
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="mt-0.5 h-5 w-5 text-white" />
                      <div>
                        <p className="font-medium text-white">Retention check unlocked</p>
                        <p className="mt-1 text-zinc-400">
                          It&apos;s been {quiz.insights.retentionCheck.daysSinceLastAssessment} days since your last {quiz.topic} assessment.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {quiz.insights?.antiGamingDetected && (
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                    <div className="flex items-start gap-3">
                      <Brain className="mt-0.5 h-5 w-5 text-white" />
                      <div>
                        <p className="font-medium text-white">Anti-gaming challenge mode is active</p>
                        <p className="mt-1 text-zinc-400">
                          Previous same-topic perfect streaks were too fast, so this attempt will climb difficulty more aggressively.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {requiresProctoring && (
                <div className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[minmax(280px,0.95fr)_1fr]">
                  <div className="space-y-3">
                    <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
                      <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                      {!cameraReady && (
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                          <Camera className="h-8 w-8" />
                        </div>
                      )}
                      <canvas ref={canvasRef} className="hidden" />
                    </div>
                    <Button
                      size="lg"
                      className="h-12 w-full rounded-full bg-white px-6 text-base font-semibold text-black hover:bg-zinc-200"
                      onClick={handleStart}
                      disabled={!canStartQuiz}
                    >
                      {isPending ? 'Starting session...' : 'Start Test'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-full border-white/20 bg-transparent text-white hover:bg-white hover:text-black"
                      onClick={() => void retryProctoringCheck()}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Retry camera/proctoring check
                    </Button>
                    {startError && (
                      <div className="rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm font-medium text-red-100">
                        {startError}
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <DevicePermissionPanel
                      kind="camera"
                      permission={cameraPermission}
                      ready={cameraReady}
                      onRequest={requestCameraPermission}
                    />
                    {cameraReady && (
                      <CameraVisibilityPanel visibility={cameraVisibility} onRetry={retryProctoringCheck} />
                    )}
                    <DevicePermissionPanel
                      kind="microphone"
                      permission={microphonePermission}
                      ready={microphoneReady}
                      required={microphoneRequired}
                      onRequest={requestMicrophonePermission}
                    />
                    <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={consentAccepted}
                        onChange={(event) => setConsentAccepted(event.target.checked)}
                        className="mt-0.5 h-7 w-7 shrink-0 rounded-md border-white/30 bg-black accent-white"
                      />
                      <span>I consent to camera, microphone, fullscreen, focus, network, clipboard, and browser-lock proctoring for this quiz.</span>
                    </label>
                    <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                      <ReadinessLine label="Browser compatibility" ready={browserCompatibilityValid} detail={browserCompatibilityMessage} />
                      <ReadinessLine label="Fullscreen readiness" ready={fullscreenReady} detail={fullscreenReady ? 'Requested when Start Quiz is clicked' : 'Fullscreen unsupported'} />
                    </div>
                    {showPermissionDebug && <PermissionDebugPanel debug={permissionDebug} />}
                  </div>
                </div>
              )}

              {!requiresProctoring && (
                <Button
                  size="lg"
                  className="h-14 rounded-full bg-white px-8 text-base font-semibold text-black hover:bg-zinc-200"
                  onClick={handleStart}
                  disabled={!canStartQuiz}
                >
                  {isPending ? 'Starting session...' : 'Start Test'}
                </Button>
              )}
              {startError && !requiresProctoring && (
                <p className="text-sm font-medium text-red-300">{startError}</p>
              )}
            </div>

            <div className="relative flex flex-col justify-between gap-6 rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-6">
              <div className="absolute right-4 top-4">
                <MonochromeOrb className="h-28 w-28" />
              </div>
              {readiness ? <ReadinessMeter readiness={readiness} className="mt-24 bg-white text-black" /> : null}
              <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Live Intelligence Stack</p>
                <div className="mt-4 grid gap-3 text-sm text-zinc-300">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
                    <span>Cognitive load detector</span>
                    <span className="text-white">On</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
                    <span>Fullscreen lock</span>
                    <span className="text-white">Required</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
                    <span>Violation auto-submit</span>
                    <span className="text-white">3 strikes</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
                    <span>Predictive readiness gate</span>
                    <span className="text-white">{readiness?.status || 'ready'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (finished || submitting) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center text-white" aria-busy="true">
        <div className="animate-pulse">
          <Trophy className="mx-auto mb-4 h-16 w-16 text-white" />
        </div>
        <h2 className="mb-2 text-2xl font-semibold">Submitting adaptive report...</h2>
        <p className="text-zinc-400">Calculating performance, pressure signals, and readiness deltas.</p>
      </div>
    )
  }

  if (!questions.length) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center text-center">
        <XCircle className="mx-auto mb-4 h-16 w-16 text-red-400" />
        <h2 className="mb-2 text-2xl font-semibold">No questions available</h2>
        <p className="text-zinc-500">This quiz does not have any questions yet. Please contact your manager.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <canvas
        ref={hiddenCanvasRef}
        width={800}
        height={600}
        style={{ display: 'none' }}
      />
      {requiresProctoring && (
        <ProctoringStatusBar
          cameraReady={cameraReady}
          microphoneReady={microphoneRequired ? microphoneReady : true}
          screenReady={Boolean(document.fullscreenElement)}
          warningCount={violationCount}
        />
      )}
      {multipleFacesAlertAt && (
        <div className="fixed inset-x-0 top-12 z-[60] mx-auto max-w-2xl px-4">
          <div className="flex items-center gap-4 rounded-2xl border-2 border-red-500 bg-red-600 px-5 py-4 text-white shadow-2xl">
            <ShieldAlert className="h-7 w-7 shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-lg leading-tight">Multiple People Detected!</p>
              <p className="text-sm text-red-100">Only one person is allowed during the assessment. This violation has been recorded and reported.</p>
            </div>
            <button type="button" onClick={() => setMultipleFacesAlertAt(null)} className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30">
              Dismiss
            </button>
          </div>
        </div>
      )}
      <ViolationToast
        items={violationToasts}
        onDismiss={(id) => setViolationToasts((previous) => previous.filter((item) => item.id !== id))}
      />
      <WarningModal warning={warningModal} onDismiss={() => setWarningModal(null)} />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-zinc-800 bg-black px-5 py-4 text-white shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <div className="flex flex-wrap items-center gap-3">
              <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                quiz.time_limit_minutes > 0 && timeRemaining < 60 ? 'bg-white text-black' : 'bg-white/5 text-white'
              }`}>
                <Clock className="h-4 w-4" />
                {quiz.time_limit_minutes > 0 ? formatTime(timeRemaining) : formatTime(totalTime)}
              </div>
              <Badge variant="outline" className="border-white/20 bg-transparent text-white">
                Adaptive target: {liveState.adaptiveDifficulty}
              </Badge>
            </div>
            <div className="text-sm text-zinc-400">
              Question {currentIndex + 1} / {totalQuestions}
            </div>
          </div>

          <Progress value={progress} className="h-2 bg-zinc-200" />

          {submitError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <strong>Submission failed:</strong> {submitError}
              <button type="button" onClick={() => setSubmitError(null)} className="ml-4 underline">
                Dismiss
              </button>
            </div>
          )}

          {draftStorageWarning && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Draft saving is unavailable in this browser. Complete the quiz in one session to avoid losing answers.
            </div>
          )}

          {(liveState.cooldownSuggested || quiz.insights?.antiGamingDetected) && (
            <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                {liveState.cooldownSuggested ? (
                  <Snowflake className="mt-0.5 h-5 w-5 text-black" />
                ) : (
                  <Brain className="mt-0.5 h-5 w-5 text-black" />
                )}
                <div>
                  <p className="font-semibold text-black">
                    {liveState.cooldownSuggested ? 'Cooldown suggested' : 'Challenge mode is active'}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">{liveState.message}</p>
                </div>
              </div>
            </div>
          )}

          <Card className="overflow-hidden border-zinc-900 bg-black text-white shadow-[0_40px_120px_rgba(0,0,0,0.4)]">
            <CardHeader className="border-b border-white/10 bg-white/[0.03]">
              <div className="flex items-center justify-between">
                <Badge className="border-white/10 bg-white/10 capitalize text-white">{currentQuestion?.difficulty}</Badge>
                <span className="text-xs uppercase tracking-[0.3em] text-zinc-500">SkillTest_AI Live</span>
              </div>
              <CardTitle className="mt-4 text-2xl leading-relaxed">{currentQuestion?.question_text}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 p-6">
              {currentQuestion?.options?.map((option, index: number) => {
                const isSelected = selectedOption === index
                let style = 'border-white/10 bg-white/5 hover:border-white/40'

                if (showFeedback) {
                  if (isSelected) style = 'border-white bg-white text-black'
                  else style = 'border-white/5 bg-white/[0.03] text-zinc-500'
                } else if (isSelected) {
                  style = 'border-white bg-white text-black'
                }

                return (
                  <button
                    key={index}
                    onClick={() => handleSelectOption(index)}
                    disabled={submitting}
                    className={`w-full rounded-[1.5rem] border p-4 text-left transition-all ${style}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                        isSelected
                              ? 'bg-black text-white'
                              : 'bg-white/10 text-white'
                      }`}>
                        {showFeedback && isSelected ? <CheckCircle2 className="h-4 w-4" /> : String.fromCharCode(65 + index)}
                      </div>
                      <span className="text-sm">{option.text}</span>
                      {showFeedback && isSelected && (
                        <Badge className="ml-auto border-white/20 bg-black text-white">
                          Saved
                        </Badge>
                      )}
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {readiness ? <ReadinessMeter readiness={readiness} /> : null}

          {requiresProctoring && (
            <Card className="border-zinc-200 bg-white">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-black">
                  <Eye className="h-4 w-4" />
                  Proctoring status
                </div>
                <div className="relative aspect-video overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950">
                  <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  {/* Reference photo badge — shown once the snapshot is captured */}
                  {referencePhotoUrl && (
                    <div className="absolute bottom-2 right-2 flex flex-col items-center gap-0.5">
                      <img
                        src={referencePhotoUrl}
                        alt="Reference snapshot"
                        className="h-12 w-12 rounded-lg border-2 border-green-400 object-cover shadow-lg"
                      />
                      <span className="rounded bg-black/70 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-green-400">
                        ID Photo
                      </span>
                    </div>
                  )}
                </div>
                <SignalRow
                  label="Camera"
                  active={cameraReady}
                  description={cameraReady ? 'Camera stream is active.' : 'Camera must stay enabled.'}
                />
                <SignalRow
                  label="Microphone"
                  active={microphoneReady}
                  description={microphoneReady ? 'Microphone permission is active.' : 'Microphone permission is required.'}
                />
                <SignalRow
                  label="Violations"
                  active={violationCount > 0}
                  description={`${violationCount}/${PROCTORING_VIOLATION_LIMIT} before auto-submit.`}
                />
                <SignalRow
                  label="Risk score"
                  active={riskScore >= 31}
                  description={`${riskScore}/${PROCTORING_CRITICAL_RISK_SCORE}+ integrity risk.`}
                />
                {latestViolation && (
                  <div className="rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                    {latestViolation}
                  </div>
                )}
                <ViolationHistoryPanel events={recentViolations} />
                {showPermissionDebug && <PermissionDebugPanel debug={permissionDebug} dark={false} />}
              </CardContent>
            </Card>
          )}

          <Card className="border-zinc-200 bg-white">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-black">
                <Brain className="h-4 w-4" />
                Live behavioral AI
              </div>
              <SignalRow
                label="Cognitive load"
                active={liveState.cognitiveLoad}
                description={liveState.cognitiveLoad ? 'Easy-question hesitation crossed 15 seconds.' : 'Within healthy range.'}
              />
              <SignalRow
                label="Panic mode"
                active={liveState.panicMode}
                description={liveState.panicMode ? 'Fast wrong answers are clustering.' : 'No panic signature detected.'}
              />
              <SignalRow
                label="Next batch"
                active
                description={`Realtime engine is aiming for ${liveState.adaptiveDifficulty} next.`}
              />
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  )
}

function visionViolationTypeToEventType(type: string): ProctoringEventType {
  const map: Record<string, ProctoringEventType> = {
    multiple_faces: 'multiple_faces',
    no_face: 'no_face',
    gaze_down: 'gaze_down',
    gaze_away: 'gaze_away',
    phone_detected: 'phone_detected',
    electronic_device: 'electronic_device',
    book_detected: 'book_detected',
    tab_switch: 'tab_switch',
    focus_loss: 'focus_loss',
    fullscreen_exit: 'fullscreen_exit',
    copy_detected: 'copy_detected',
    paste_detected: 'paste_detected',
    right_click: 'right_click',
    dev_tools: 'dev_tools',
    screenshot_attempt: 'screenshot_attempt',
    window_switch: 'window_switch',
    face_substitution: 'face_substitution',
  }
  return map[type] || 'face-covered'
}

function getProctoringDedupeWindowMs(type: ProctoringEventType) {
  const windows: Partial<Record<ProctoringEventType, number>> = {
    'copy-attempt': 2500,
    'paste-attempt': 2500,
    'context-menu': 2000,
    'blocked-shortcut': 1500,
    'tab-hidden': 2500,
    tab_switch: 2500,
    'window-blur': 2500,
    focus_loss: 2500,
    window_switch: 2500,
    'fullscreen-exit': 2500,
    fullscreen_exit: 2500,
    copy_detected: 2500,
    paste_detected: 2500,
    right_click: 2000,
    dev_tools: 2500,
    screenshot_attempt: 2500,
    'camera-lost': 3000,
    'microphone-denied': 3000,
    no_face: 3500,
    'no-face': 3500,
    'face-covered': 3000,
    multiple_faces: 3500,
    'multiple-faces': 3500,
  }
  return windows[type] ?? 1200
}

function getProctoringWarningSafeClearMs(type: ProctoringEventType) {
  const windows: Partial<Record<ProctoringEventType, number>> = {
    multiple_faces: 12_000,
    'multiple-faces': 12_000,
    phone_detected: 14_000,
    'phone-detected': 14_000,
    electronic_device: 14_000,
    face_substitution: 20_000,
    no_face: 10_000,
    'no-face': 10_000,
    'face-covered': 10_000,
  }
  return windows[type] ?? 8_000
}

function ProctoringStatusBar({
  cameraReady,
  microphoneReady,
  screenReady,
  warningCount,
}: {
  cameraReady: boolean
  microphoneReady: boolean
  screenReady: boolean
  warningCount: number
}) {
  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-zinc-900/10 bg-white/95 px-4 py-2 text-xs font-semibold text-zinc-900 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusPill label="Camera" active={cameraReady} />
          <StatusPill label="Mic" active={microphoneReady} />
          <StatusPill label="Screen" active={screenReady} />
        </div>
        <div className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">
          Warning Count: {warningCount}
        </div>
      </div>
    </div>
  )
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${active ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
      <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {label}
    </span>
  )
}

function WarningModal({ warning, onDismiss }: { warning: WarningModalState; onDismiss: () => void }) {
  const isMultiFace = warning?.type === 'multiple_faces'
  const autoCloseSeconds = isMultiFace ? 10 : 5
  const [secondsLeft, setSecondsLeft] = useState(autoCloseSeconds)

  useEffect(() => {
    if (!warning) return
    setSecondsLeft(autoCloseSeconds)
    const interval = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(interval)
          onDismiss()
          return 0
        }
        return previous - 1
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [autoCloseSeconds, onDismiss, warning])

  if (!warning) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 px-4" role="alertdialog" aria-modal="true" aria-labelledby="proctoring-warning-title">
      <div className="w-full max-w-lg animate-in zoom-in-95 rounded-2xl border border-red-300 bg-gradient-to-br from-red-700 via-rose-700 to-red-950 p-8 text-center text-white shadow-2xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white text-5xl text-red-700">⚠</div>
        <h2 id="proctoring-warning-title" className="mt-6 text-4xl font-black tracking-tight">
          {isMultiFace ? 'MULTIPLE PEOPLE DETECTED' : 'WARNING'}
        </h2>
        <p className="mt-4 text-xl font-semibold">{warning.label}</p>
        {isMultiFace && (
          <p className="mt-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-red-100">
            Only one person is allowed during the assessment. Repeated violations will result in automatic submission and your attempt being flagged for review.
          </p>
        )}
        <p className="mt-3 text-sm text-red-100">This incident has been recorded and reported to your administrator.</p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 rounded-full bg-white px-6 py-3 text-sm font-bold text-red-800 hover:bg-red-50"
        >
          I Understand ({secondsLeft})
        </button>
      </div>
    </div>
  )
}

function ViolationHistoryPanel({ events }: { events: ProctoringEvent[] }) {
  return (
    <div className="rounded-[1.25rem] border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-semibold text-black">Recent violations</p>
      {events.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">No violations recorded in this session.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {events.map((event, index) => (
            <div key={`${event.type}-${event.occurredAt}-${index}`} className="rounded-xl border border-red-100 bg-white px-3 py-2">
              <p className="text-xs font-semibold text-red-900">{humanViolationLabel(event.type, event.label)}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{new Date(event.occurredAt).toLocaleTimeString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function humanViolationLabel(type: ProctoringEventType, fallback: string) {
  const labels: Partial<Record<ProctoringEventType, string>> = {
    'tab-hidden': 'Tab Switch',
    tab_switch: 'Tab Switch',
    'no-face': 'Face Missing',
    no_face: 'Face Missing',
    'multiple-faces': 'Multiple Faces',
    multiple_faces: 'Multiple Faces',
    'gaze-away': 'Looking Away',
    gaze_away: 'Looking Away',
    gaze_down: 'Looking Down',
    'phone-detected': 'Phone Detected',
    phone_detected: 'Phone Detected',
    electronic_device: 'Device Detected',
    'copy-attempt': 'Copy/Paste',
    'paste-attempt': 'Copy/Paste',
    'fullscreen-exit': 'Screen Exit',
    fullscreen_exit: 'Screen Exit',
    'window-blur': 'Window Blur',
  }
  return labels[type] || fallback
}

function difficultyValue(level?: string | null) {
  const map: Record<string, number> = {
    easy: 1,
    medium: 2,
    hard: 3,
    advanced: 4,
    hardcore: 5,
  }
  return map[level || 'medium'] || 2
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
      <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function DevicePermissionPanel({
  kind,
  permission,
  ready,
  required = true,
  onRequest,
}: {
  kind: DeviceKind
  permission: DevicePermission
  ready: boolean
  required?: boolean
  onRequest: () => void
}) {
  const label = kind === 'camera' ? 'Camera' : 'Microphone'
  const Icon = kind === 'camera' ? Camera : Mic
  const statusLabel = getDeviceStatusLabel(permission.status)
  const buttonLabel = permission.status === 'denied'
    ? `Retry ${label} Permission`
    : permission.status === 'checking'
      ? `Checking ${label}...`
      : ready
        ? `${label} Granted`
        : `Enable ${label}`
  const disabled = permission.status === 'checking' || ready || permission.status === 'unsupported' || permission.status === 'insecure'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{label} Status: {statusLabel}</p>
          <p className="mt-1 text-xs text-zinc-400">{required ? `${label} is required for this proctored quiz.` : `${label} is optional for this quiz.`}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-10 rounded-full border-white/20 bg-transparent text-white hover:bg-white hover:text-black"
          onClick={onRequest}
          disabled={disabled}
        >
          <Icon className="mr-2 h-4 w-4" />
          {buttonLabel}
        </Button>
      </div>
      {permission.message && (
        <p className={`mt-3 text-xs font-medium ${ready ? 'text-emerald-300' : 'text-red-300'}`}>
          {permission.message}
        </p>
      )}
      {permission.status === 'denied' && (
        <p className="mt-2 text-xs text-zinc-400">
          Open the browser lock icon or Site settings, allow {kind}, then click Retry {label} Permission.
        </p>
      )}
    </div>
  )
}

function CameraVisibilityPanel({ visibility, onRetry }: { visibility: CameraVisibilityState; onRetry: () => void }) {
  const ready = visibility.status === 'visible'
  const checking = visibility.status === 'checking' || visibility.status === 'model_loading'
  const tone = ready
    ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'
    : checking
      ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-100'
      : 'border-red-300/40 bg-red-500/15 text-red-100'

  return (
    <div className={`rounded-2xl border p-4 ${tone}`} aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Face visibility check: {ready ? 'Passed' : checking ? 'Checking' : 'Blocked'}</p>
          <p className="mt-1 text-xs opacity-85">{visibility.message}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-10 rounded-full border-white/25 bg-black/20 text-white hover:bg-white hover:text-black"
          onClick={() => void onRetry()}
          disabled={checking}
        >
          <Eye className="mr-2 h-4 w-4" />
          Retry check
        </Button>
      </div>
      {!ready && visibility.status !== 'model_error' && (
        <p className="mt-3 rounded-xl bg-black/25 px-3 py-2 text-xs font-medium">
          Remove camera covers, turn on room light, sit centered, and keep your full face inside the preview.
        </p>
      )}
      {visibility.status === 'model_error' && (
        <p className="mt-3 rounded-xl bg-black/25 px-3 py-2 text-xs font-medium">
          Retry the proctoring check. If it fails again, refresh once or contact admin.
        </p>
      )}
    </div>
  )
}

function waitForLiveVideoFrame(video: HTMLVideoElement, timeoutMs = 1500) {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve(true)
  }

  return new Promise<boolean>((resolve) => {
    let settled = false
    const done = (ready: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      video.removeEventListener('loadeddata', onFrame)
      video.removeEventListener('canplay', onFrame)
      video.removeEventListener('timeupdate', onFrame)
      resolve(ready)
    }
    const onFrame = () => {
      done(video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0)
    }
    const timeoutId = window.setTimeout(() => done(false), timeoutMs)
    video.addEventListener('loadeddata', onFrame)
    video.addEventListener('canplay', onFrame)
    video.addEventListener('timeupdate', onFrame)
  })
}

function getDeviceStatusLabel(status: DeviceStatus) {
  switch (status) {
    case 'checking':
      return 'Checking'
    case 'granted':
      return 'Granted'
    case 'denied':
      return 'Denied'
    case 'missing':
      return 'Device Not Found'
    case 'busy':
      return 'Device Busy'
    case 'unsupported':
      return 'Unsupported'
    case 'insecure':
      return 'Blocked'
    case 'error':
      return 'Error'
    case 'required':
    default:
      return 'Permission Required'
  }
}

function ReadinessLine({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-zinc-300">{label}</span>
        <span className={ready ? 'text-emerald-300' : 'text-red-300'}>{ready ? 'Ready' : 'Blocked'}</span>
      </div>
      <p className="mt-1 text-zinc-500">{detail}</p>
    </div>
  )
}

function PermissionDebugPanel({ debug, dark = true }: { debug: PermissionDebugState; dark?: boolean }) {
  const rows = [
    ['secureContext', debug.secureContext === null ? 'unknown' : String(debug.secureContext)],
    ['navigator.mediaDevices exists', String(debug.mediaDevicesExists)],
    ['camera permission state', debug.cameraPermissionState || 'unknown'],
    ['microphone permission state', debug.microphonePermissionState || 'unknown'],
    ['last getUserMedia call timestamp', debug.lastGetUserMediaCallAt || 'none'],
    ['last getUserMedia error name', debug.lastGetUserMediaErrorName || 'none'],
    ['last getUserMedia error message', debug.lastGetUserMediaErrorMessage || 'none'],
    ['active video track count', String(debug.activeVideoTrackCount)],
    ['active audio track count', String(debug.activeAudioTrackCount)],
  ]

  return (
    <div className={`rounded-2xl border p-4 text-xs ${
      dark
        ? 'border-white/10 bg-black/30 text-zinc-300'
        : 'border-zinc-200 bg-zinc-50 text-zinc-700'
    }`}>
      <p className={`mb-3 font-semibold ${dark ? 'text-white' : 'text-black'}`}>Permission debug</p>
      <dl className="grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[180px_1fr]">
            <dt className={dark ? 'text-zinc-500' : 'text-zinc-500'}>{label}</dt>
            <dd className="break-words font-mono">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function SignalRow({
  label,
  active,
  description,
}: {
  label: string
  active: boolean
  description: string
}) {
  return (
    <div className="rounded-[1.25rem] border border-zinc-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-black">{label}</p>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] ${
          active ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-500'
        }`}>
          {active ? 'Active' : 'Quiet'}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </div>
  )
}
