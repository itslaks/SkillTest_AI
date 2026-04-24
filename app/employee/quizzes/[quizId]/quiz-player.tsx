'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { MonochromeOrb } from '@/components/insights/monochrome-orb'
import { ReadinessMeter } from '@/components/insights/readiness-meter'
import { startQuizAttempt, submitQuizAttempt } from '@/lib/actions/employee'
import { shiftDifficulty } from '@/lib/insights'
import type { DifficultyLevel, QuizAnswer } from '@/lib/types/database'
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
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
  const [currentIndex, setCurrentIndex] = useState(0)
  const [questionOrder, setQuestionOrder] = useState<string[]>(
    (quiz.questions || []).map((question: any) => question.id)
  )
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const answersRef = useRef<QuizAnswer[]>([])
  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [streak, setStreak] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
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

  const questions = quiz.questions || []
  const questionMap = new Map(questions.map((question: any) => [question.id, question]))
  const currentQuestion = questionMap.get(questionOrder[currentIndex])
  const totalQuestions = questions.length
  const progress = totalQuestions > 0 ? ((currentIndex + (showFeedback ? 1 : 0)) / totalQuestions) * 100 : 0
  const readiness = quiz.insights?.readiness

  useEffect(() => {
    if (!started || finished) return
    const interval = setInterval(() => {
      if (quiz.time_limit_minutes > 0) {
        setTimeRemaining((previous: number) => {
          if (previous <= 1) {
            clearInterval(interval)
            handleAutoSubmit()
            return 0
          }
          return previous - 1
        })
      }
      setTotalTime((previous) => previous + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [started, finished, quiz.time_limit_minutes])

  function handleAutoSubmit() {
    if (!finishedRef.current) {
      finishedRef.current = true
      setFinished(true)
      doSubmit(answersRef.current)
    }
  }

  function handleStart() {
    startTransition(async () => {
      await startQuizAttempt(quiz.id)
      setStarted(true)
      setQuestionStartTime(Date.now())
    })
  }

  function handleSelectOption(optionIndex: number) {
    if (showFeedback || finished) return
    setSelectedOption(optionIndex)
  }

  function buildAdaptiveOrder(targetDifficulty: DifficultyLevel) {
    const completedIds = new Set(questionOrder.slice(0, currentIndex + 1))
    const remaining = questions.filter((question: any) => !completedIds.has(question.id))
    remaining.sort((left: any, right: any) => {
      const leftDistance = Math.abs(difficultyValue(left.difficulty) - difficultyValue(targetDifficulty))
      const rightDistance = Math.abs(difficultyValue(right.difficulty) - difficultyValue(targetDifficulty))
      return leftDistance - rightDistance
    })

    setQuestionOrder([
      ...questionOrder.slice(0, currentIndex + 1),
      ...remaining.map((question: any) => question.id),
    ])
  }

  function handleConfirmAnswer() {
    if (selectedOption === null || !currentQuestion) return

    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000)
    const questionDifficulty = (currentQuestion.difficulty || quiz.difficulty || 'medium') as DifficultyLevel
    const isCorrect = currentQuestion.options[selectedOption]?.isCorrect === true
    const cognitiveLoadFlag = questionDifficulty === 'easy' && timeSpent > 15
    const panicSignal = !isCorrect && timeSpent <= 5
    const recentFastWrong = [...answersRef.current.slice(-1), { panicSignal }].filter((answer) => answer.panicSignal).length
    const panicMode = recentFastWrong >= 2
    const adaptiveDifficulty = quiz.insights?.antiGamingDetected
      ? shiftDifficulty(questionDifficulty, 1)
      : cognitiveLoadFlag || panicMode
        ? shiftDifficulty(questionDifficulty, -1)
        : shiftDifficulty(questionDifficulty, 1)

    const answer: QuizAnswer = {
      questionId: currentQuestion.id,
      selectedOption,
      isCorrect,
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

    if (isCorrect) setStreak((previous) => previous + 1)
    else setStreak(0)
  }

  function handleNext() {
    if (currentIndex + 1 >= totalQuestions) {
      finishedRef.current = true
      setFinished(true)
      doSubmit([...answers])
      return
    }

    setCurrentIndex((previous) => previous + 1)
    setSelectedOption(null)
    setShowFeedback(false)
    setQuestionStartTime(Date.now())
  }

  function doSubmit(finalAnswers: QuizAnswer[]) {
    setSubmitting(true)
    startTransition(async () => {
      const result = await submitQuizAttempt({
        quiz_id: quiz.id,
        answers: finalAnswers,
        time_taken_seconds: totalTime,
      })

      if (result.error) {
        setSubmitting(false)
        return
      }

      router.push(`/employee/quizzes/${quiz.id}/results`)
    })
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
                Adaptive SkillTest Session
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

              <Button
                size="lg"
                className="h-14 rounded-full bg-white px-8 text-base font-semibold text-black hover:bg-zinc-200"
                onClick={handleStart}
                disabled={isPending}
              >
                {isPending ? 'Starting session...' : 'Launch adaptive quiz'}
              </Button>
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
                    <span>Emotional state inference</span>
                    <span className="text-white">On</span>
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
              {streak >= 2 && (
                <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
                  <Flame className="h-4 w-4" />
                  {streak} streak
                </div>
              )}
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
                <span className="text-xs uppercase tracking-[0.3em] text-zinc-500">SkillTest Live</span>
              </div>
              <CardTitle className="mt-4 text-2xl leading-relaxed">{currentQuestion?.question_text}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 p-6">
              {currentQuestion?.options?.map((option: any, index: number) => {
                const isSelected = selectedOption === index
                const isCorrect = option.isCorrect
                let style = 'border-white/10 bg-white/5 hover:border-white/40'

                if (showFeedback) {
                  if (isCorrect) style = 'border-white bg-white text-black'
                  else if (isSelected && !isCorrect) style = 'border-zinc-500 bg-zinc-900 text-white'
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
                        showFeedback && isCorrect
                          ? 'bg-black text-white'
                          : showFeedback && isSelected && !isCorrect
                            ? 'bg-white text-black'
                            : isSelected
                              ? 'bg-black text-white'
                              : 'bg-white/10 text-white'
                      }`}>
                        {showFeedback && isCorrect ? <CheckCircle2 className="h-4 w-4" /> : String.fromCharCode(65 + index)}
                      </div>
                      <span className="text-sm">{option.text}</span>
                    </div>
                  </button>
                )
              })}

              {showFeedback && currentQuestion?.explanation && (
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <p className="mb-1 text-sm font-medium text-white">Explanation</p>
                  <p className="text-sm text-zinc-400">{currentQuestion.explanation}</p>
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
