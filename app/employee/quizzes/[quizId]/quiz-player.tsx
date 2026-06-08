'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { MonochromeOrb } from '@/components/insights/monochrome-orb'
import { ReadinessMeter } from '@/components/insights/readiness-meter'
import { startQuizAttempt, submitQuizAttempt } from '@/lib/actions/employee'
import { shiftDifficulty } from '@/lib/insights'
import type { DifficultyLevel, ProctoringEvent, ProctoringEventType, ProctoringSubmission, SubmittedQuizAnswer } from '@/lib/types/database'
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
  ChevronRight,
  Clock,
  Eye,
  LockKeyhole,
  Mic,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Trophy,
  XCircle,
  Zap,
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
  const [permissionDebug, setPermissionDebug] = useState<PermissionDebugState>(initialPermissionDebugState)
  const [browserCapabilities, setBrowserCapabilities] = useState<BrowserCapabilities>(initialBrowserCapabilities)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  const [riskScore, setRiskScore] = useState(0)
  const [latestViolation, setLatestViolation] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const proctoringEventsRef = useRef<ProctoringEvent[]>([])
  const violationCountRef = useRef(0)
  const proctoringSessionIdRef = useRef<string | null>(null)
  const attemptIdRef = useRef<string | null>(null)
  const submittingRef = useRef(false)
  const activeSignalRef = useRef<Record<string, boolean>>({})
  const proctoringEventRetryQueueRef = useRef<ProctoringEventPostPayload[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [draftStorageWarning, setDraftStorageWarning] = useState(false)

  useEffect(() => {
    setMounted(true)
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
    setPermissionDebug((previous) => ({
      ...previous,
      activeVideoTrackCount: 0,
      activeAudioTrackCount: 0,
    }))
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
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return null

    const width = video.videoWidth || 320
    const height = video.videoHeight || 240
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(video, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', 0.58)
  }, [])

  const handleAutoSubmit = useCallback((proctoring?: ProctoringSubmission) => {
    if (!finishedRef.current) {
      finishedRef.current = true
      setFinished(true)
      doSubmit(getFinalAnswersForSubmit(), proctoring || buildProctoringSubmission(true))
    }
  }, [buildProctoringSubmission, doSubmit, getFinalAnswersForSubmit])

  const recordProctoringViolation = useCallback((type: ProctoringEventType, label: string) => {
    if (!requiresProctoring || !started || finishedRef.current || submittingRef.current) return

    setLatestViolation(label)

    const event: ProctoringEvent = {
      type,
      label,
      occurredAt: new Date().toISOString(),
      questionIndex: currentIndex,
      riskScore: getProctoringEventRisk(type),
      riskLevel: getProctoringRiskLevel(getProctoringEventRisk(type)),
    }
    proctoringEventsRef.current = [...proctoringEventsRef.current, event].slice(-50)

    const sessionId = proctoringSessionIdRef.current
    const attemptId = attemptIdRef.current
    if (!sessionId || !attemptId) return

    const payload: ProctoringEventPostPayload = {
      sessionId,
      attemptId,
      type,
      label,
      questionIndex: currentIndex,
      evidenceImage: captureEvidenceFrame(),
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

      stream.getTracks().forEach((track) => track.stop())
      logPermissionDebug(`${kind} getUserMedia success`, { trackCount: tracks.length })
      updatePermissionDebug({
        lastGetUserMediaErrorName: null,
        lastGetUserMediaErrorMessage: null,
        [kind === 'camera' ? 'cameraPermissionState' : 'microphonePermissionState']: 'granted',
        activeVideoTrackCount: 0,
        activeAudioTrackCount: 0,
      })
      setPermission({
        status: 'granted',
        message: kind === 'camera' ? 'Camera permission is granted.' : 'Microphone permission is granted.',
        permissionState: 'granted',
      })
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
  }, [deviceErrorMessage, logPermissionDebug, updatePermissionDebug])

  const requestCameraPermission = useCallback(() => {
    void requestDevicePermission('camera')
  }, [requestDevicePermission])

  const requestMicrophonePermission = useCallback(() => {
    void requestDevicePermission('microphone')
  }, [requestDevicePermission])

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
    window.history.pushState({ proctoredQuiz: true }, '', window.location.href)
    startTransition(async () => {
      const result = await startQuizAttempt(quiz.id, {
        cameraReady,
        microphoneReady,
        fullscreenReady: Boolean(document.fullscreenElement),
        consentAccepted: true,
      })
      if (result.error) {
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
    return () => stopMediaStream()
  }, [stopMediaStream])

  useEffect(() => {
    if (!cameraReady || !videoRef.current || !mediaStreamRef.current) return
    if (videoRef.current.srcObject !== mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current
      videoRef.current.play().catch(() => undefined)
    }
  }, [cameraReady, started])

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
    const onOffline = () => recordProctoringViolation('network-offline', 'Network connection went offline during the quiz.')
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const blocked = event.metaKey || event.ctrlKey || event.altKey || key === 'f11'
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
    document.addEventListener('paste', onPaste)
    window.addEventListener('offline', onOffline)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('beforeunload', onBeforeUnload)

    const tracks = mediaStreamRef.current?.getVideoTracks() || []
    const onCameraEnded = () => recordProctoringViolation('camera-lost', 'Camera stream stopped during the quiz.')
    tracks.forEach((track) => track.addEventListener('ended', onCameraEnded))
    const devtoolsInterval = window.setInterval(() => {
      const likelyOpen = (window.outerWidth - window.innerWidth > 180) || (window.outerHeight - window.innerHeight > 180)
      if (likelyOpen && !activeSignalRef.current.devtoolsOpen) {
        activeSignalRef.current.devtoolsOpen = true
        recordProctoringViolation('devtools-open', 'Developer tools or inspection panel may have been opened.')
      }
      if (!likelyOpen) activeSignalRef.current.devtoolsOpen = false
    }, 8000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('beforeunload', onBeforeUnload)
      tracks.forEach((track) => track.removeEventListener('ended', onCameraEnded))
      window.clearInterval(devtoolsInterval)
    }
  }, [finished, recordProctoringViolation, requiresProctoring, started])

  function handleSelectOption(optionIndex: number) {
    if (showFeedback || finished) return
    setSelectedOption(optionIndex)
  }

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

  function handleConfirmAnswer() {
    if (selectedOption === null || !currentQuestion) return

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
    const selectedOriginalOption = currentQuestion.options[selectedOption]?.optionId

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

    setAnswers((previous) => [...previous, answer])
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
  }

  function handleNext() {
    if (currentIndex + 1 >= totalQuestions) {
      finishedRef.current = true
      setFinished(true)
      doSubmit(getFinalAnswersForSubmit(), requiresProctoring ? buildProctoringSubmission(false) : undefined)
      return
    }

    setCurrentIndex((previous) => previous + 1)
    setSelectedOption(null)
    setShowFeedback(false)
    setQuestionStartTime(Date.now())
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
                <div className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[180px_1fr]">
                  <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
                    <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                        <Camera className="h-8 w-8" />
                      </div>
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  <div className="space-y-4">
                    <DevicePermissionPanel
                      kind="camera"
                      permission={cameraPermission}
                      ready={cameraReady}
                      onRequest={requestCameraPermission}
                    />
                    <DevicePermissionPanel
                      kind="microphone"
                      permission={microphonePermission}
                      ready={microphoneReady}
                      required={microphoneRequired}
                      onRequest={requestMicrophonePermission}
                    />
                    <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-300">
                      <input
                        type="checkbox"
                        checked={consentAccepted}
                        onChange={(event) => setConsentAccepted(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-black"
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

              <Button
                size="lg"
                className="h-14 rounded-full bg-white px-8 text-base font-semibold text-black hover:bg-zinc-200"
                onClick={handleStart}
                disabled={!canStartQuiz}
              >
                {isPending ? 'Starting session...' : requiresProctoring ? 'Start Quiz' : 'Start Quiz'}
              </Button>
              {startError && (
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
                    disabled={showFeedback}
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

              {showFeedback && (
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <p className="mb-1 text-sm font-medium text-white">Answer locked</p>
                  <p className="text-sm text-zinc-400">Correct answers and explanations are shown only after the full quiz is submitted.</p>
                </div>
              )}
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

      <div className="flex justify-end">
        {!showFeedback ? (
          <Button
            onClick={handleConfirmAnswer}
            disabled={selectedOption === null || submitting}
            aria-disabled={selectedOption === null || submitting}
            size="lg"
            className="h-12 rounded-full bg-black px-7 text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirm answer
            <Zap className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={submitting}
            aria-disabled={submitting}
            size="lg"
            className="h-12 rounded-full bg-black px-7 text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {currentIndex + 1 >= totalQuestions ? 'Finish adaptive quiz' : 'Next question'}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
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
