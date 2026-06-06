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
  PROCTORING_CRITICAL_RISK_SCORE,
  PROCTORING_VIOLATION_LIMIT,
  shouldAutoSubmitForIntegrity,
} from '@/lib/proctoring'
import {
  Camera,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  LockKeyhole,
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
  isCorrect?: boolean
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

export function QuizPlayer({ quiz }: QuizPlayerProps) {
  const router = useRouter()
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
  const [cameraReady, setCameraReady] = useState(false)
  const [microphoneReady, setMicrophoneReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [violationCount, setViolationCount] = useState(0)
  const [riskScore, setRiskScore] = useState(0)
  const [latestViolation, setLatestViolation] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const proctoringEventsRef = useRef<ProctoringEvent[]>([])
  const violationCountRef = useRef(0)
  const submittingRef = useRef(false)
  const activeSignalRef = useRef<Record<string, boolean>>({})

  const questions = (quiz.questions || []) as QuizQuestion[]
  const questionMap = new Map<string, QuizQuestion>(questions.map((question) => [question.id, question]))
  const currentQuestion = questionMap.get(questionOrder[currentIndex])
  const totalQuestions = questions.length
  const progress = totalQuestions > 0 ? ((currentIndex + (showFeedback ? 1 : 0)) / totalQuestions) * 100 : 0
  const readiness = quiz.insights?.readiness

  const stopCamera = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
  }, [])

  const buildProctoringSubmission = useCallback((autoSubmitted: boolean, extraEvents: ProctoringEvent[] = []): ProctoringSubmission => ({
    enabled: true,
    violationCount: Math.max(violationCountRef.current, violationCount),
    riskScore: calculateProctoringRisk([...proctoringEventsRef.current, ...extraEvents]).score,
    riskLevel: calculateProctoringRisk([...proctoringEventsRef.current, ...extraEvents]).level,
    autoSubmitted,
    events: [...proctoringEventsRef.current, ...extraEvents].slice(-50),
  }), [violationCount])

  const doSubmit = useCallback((finalAnswers: SubmittedQuizAnswer[], proctoring?: ProctoringSubmission) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    stopCamera()
    startTransition(async () => {
      const result = await submitQuizAttempt({
        quiz_id: quiz.id,
        answers: finalAnswers,
        time_taken_seconds: totalTimeRef.current,
        proctoring: proctoring || buildProctoringSubmission(false),
      })

      if (result.error) {
        submittingRef.current = false
        setSubmitting(false)
        return
      }

      router.push(`/employee/quizzes/${quiz.id}/results`)
    })
  }, [buildProctoringSubmission, quiz.id, router, startTransition, stopCamera])

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
      doSubmit(answersRef.current, proctoring || buildProctoringSubmission(true))
    }
  }, [buildProctoringSubmission, doSubmit])

  const recordProctoringViolation = useCallback((type: ProctoringEventType, label: string) => {
    if (!started || finishedRef.current || submittingRef.current) return

    const nextCount = violationCountRef.current + 1
    violationCountRef.current = nextCount
    setViolationCount(nextCount)
    setLatestViolation(label)

    const event: ProctoringEvent = {
      type,
      label,
      occurredAt: new Date().toISOString(),
      questionIndex: currentIndex,
      riskScore: getProctoringEventRisk(type),
      riskLevel: getProctoringRiskLevel(getProctoringEventRisk(type)),
      evidenceImage: captureEvidenceFrame(),
    }
    proctoringEventsRef.current = [...proctoringEventsRef.current, event].slice(-50)
    const risk = calculateProctoringRisk(proctoringEventsRef.current)
    setRiskScore(risk.score)

    if (shouldAutoSubmitForIntegrity(proctoringEventsRef.current, nextCount)) {
      const autoSubmitEvent: ProctoringEvent = {
        type: 'auto-submit',
        label: risk.score > PROCTORING_CRITICAL_RISK_SCORE
          ? 'Critical integrity risk reached. Quiz auto-submitted and employee flagged.'
          : 'Violation limit reached. Quiz auto-submitted and employee flagged.',
        occurredAt: new Date().toISOString(),
        questionIndex: currentIndex,
        riskScore: 0,
        riskLevel: risk.level,
        evidenceImage: event.evidenceImage,
      }
      const summary = buildProctoringSubmission(true, [autoSubmitEvent])
      handleAutoSubmit(summary)
    }
  }, [buildProctoringSubmission, captureEvidenceFrame, currentIndex, handleAutoSubmit, started])

  useEffect(() => {
    if (!started || finished) return
    const interval = setInterval(() => {
      if (quiz.time_limit_minutes > 0) {
        setTimeRemaining((previous: number) => {
          if (previous <= 1) {
            clearInterval(interval)
            handleAutoSubmit(buildProctoringSubmission(false))
            return 0
          }
          return previous - 1
        })
      }
      setTotalTime((previous) => previous + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [started, finished, quiz.time_limit_minutes, handleAutoSubmit, buildProctoringSubmission])

  async function enableProctoring() {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      })
      mediaStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraReady(true)
      setMicrophoneReady(stream.getAudioTracks().length > 0)
    } catch {
      setCameraReady(false)
      setMicrophoneReady(false)
      setCameraError('Camera permission is required before starting a proctored quiz.')
    }
  }

  async function handleStart() {
    setStartError(null)
    if (!cameraReady) {
      setStartError('Enable camera proctoring before launching the quiz.')
      return
    }
    try {
      await document.documentElement.requestFullscreen?.()
    } catch {
      setStartError('Fullscreen could not be started. Continue only if your browser allows fullscreen.')
    }
    window.history.pushState({ proctoredQuiz: true }, '', window.location.href)
    startTransition(async () => {
      const result = await startQuizAttempt(quiz.id)
      if (result.error) {
        setStartError(result.error)
        return
      }
      setStarted(true)
      setQuestionStartTime(Date.now())
    })
  }

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  useEffect(() => {
    if (!cameraReady || !videoRef.current || !mediaStreamRef.current) return
    if (videoRef.current.srcObject !== mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current
      videoRef.current.play().catch(() => undefined)
    }
  }, [cameraReady, started])

  useEffect(() => {
    if (!started || finished) return

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
  }, [finished, recordProctoringViolation, started])

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
      doSubmit([...answersRef.current], buildProctoringSubmission(false))
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
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="mt-0.5 h-5 w-5 text-white" />
                    <div>
                      <p className="font-medium text-white">AI camera proctoring required</p>
                      <p className="mt-1 text-zinc-400">
                        Keep this tab focused, stay in fullscreen, and keep your face visible. Three warnings or critical risk auto-submit the test and notify staff with captured proof.
                      </p>
                    </div>
                  </div>
                </div>

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

              <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[160px_1fr]">
                <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
                  <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                      <Camera className="h-8 w-8" />
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                <div className="flex flex-col justify-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {cameraReady ? 'Camera and microphone verified' : 'Enable proctoring camera'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      The app checks camera, microphone, fullscreen, focus, network, clipboard, and browser-lock signals.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit rounded-full border-white/20 bg-transparent text-white hover:bg-white hover:text-black"
                    onClick={enableProctoring}
                    disabled={cameraReady}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {cameraReady ? 'Checks passed' : 'Run pre-checks'}
                  </Button>
                  {cameraError && <p className="text-xs font-medium text-red-300">{cameraError}</p>}
                </div>
              </div>

              <Button
                size="lg"
                className="h-14 rounded-full bg-white px-8 text-base font-semibold text-black hover:bg-zinc-200"
                onClick={handleStart}
                disabled={isPending || !cameraReady}
              >
                {isPending ? 'Starting session...' : 'Launch proctored quiz'}
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
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center text-white">
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
                description={microphoneReady ? 'Audio channel is available for anomaly checks.' : 'Microphone permission is required.'}
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
            </CardContent>
          </Card>

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
            disabled={selectedOption === null}
            size="lg"
            className="h-12 rounded-full bg-black px-7 text-white hover:bg-zinc-800"
          >
            Confirm answer
            <Zap className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleNext} size="lg" className="h-12 rounded-full bg-black px-7 text-white hover:bg-zinc-800">
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
