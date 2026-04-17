'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { startQuizAttempt, submitQuizAttempt } from '@/lib/actions/employee'
import {
  Clock, ChevronRight, ChevronLeft, CheckCircle2, XCircle,
  Flame, Zap, Trophy, AlertTriangle,
} from 'lucide-react'

interface QuizPlayerProps {
  quiz: any
}

export function QuizPlayer({ quiz }: QuizPlayerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [started, setStarted] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<{ questionId: string; selectedOption: number; isCorrect: boolean; timeSpent: number }[]>([])
  const answersRef = useRef(answers)
  // Keep ref in sync with state so the timer callback always has the latest answers
  useEffect(() => { answersRef.current = answers }, [answers])
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [streak, setStreak] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const [questionStartTime, setQuestionStartTime] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(quiz.time_limit_minutes * 60)
  const [finished, setFinished] = useState(false)
  const finishedRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)

  const questions = quiz.questions || []
  const currentQuestion = questions[currentIndex]
  const totalQuestions = questions.length
  const progress = totalQuestions > 0 ? ((currentIndex + (showFeedback ? 1 : 0)) / totalQuestions) * 100 : 0

  const handleAutoSubmit = useCallback(() => {
    if (!finishedRef.current) {
      finishedRef.current = true
      setFinished(true)
      doSubmit(answersRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Timer
  useEffect(() => {
    if (!started || finished) return
    const interval = setInterval(() => {
      if (quiz.time_limit_minutes > 0) {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(interval)
            handleAutoSubmit()
            return 0
          }
          return prev - 1
        })
      }
      setTotalTime(prev => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [started, finished, quiz.time_limit_minutes, handleAutoSubmit])

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

  function handleConfirmAnswer() {
    if (selectedOption === null || !currentQuestion) return

    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000)
    const isCorrect = currentQuestion.options[selectedOption]?.isCorrect === true

    const answer = {
      questionId: currentQuestion.id,
      selectedOption,
      isCorrect,
      timeSpent,
    }

    setAnswers(prev => [...prev, answer])
    setShowFeedback(true)

    if (isCorrect) {
      setStreak(prev => prev + 1)
    } else {
      setStreak(0)
    }
  }

  function handleNext() {
    if (currentIndex + 1 >= totalQuestions) {
      finishedRef.current = true
      setFinished(true)
      doSubmit([...answers])
      return
    }

    setCurrentIndex(prev => prev + 1)
    setSelectedOption(null)
    setShowFeedback(false)
    setQuestionStartTime(Date.now())
  }

  function doSubmit(finalAnswers: typeof answers) {
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

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // ─── Pre-start screen ──────────────────────────────────────────────
  if (!started) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-8 text-center">
            <h1 className="text-3xl font-bold mb-2">{quiz.title}</h1>
            <p className="text-muted-foreground">{quiz.description || quiz.topic}</p>
          </div>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{totalQuestions}</p>
                <p className="text-sm text-muted-foreground">Questions</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{quiz.time_limit_minutes > 0 ? quiz.time_limit_minutes : '∞'}</p>
                <p className="text-sm text-muted-foreground">Minutes</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold capitalize">{quiz.difficulty}</p>
                <p className="text-sm text-muted-foreground">Difficulty</p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">Before you begin</p>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 mt-1 space-y-1">
                    <li>• You have <strong>{quiz.time_limit_minutes > 0 ? `${quiz.time_limit_minutes} minutes` : 'no time limit'}</strong> to complete this quiz</li>
                    <li>• Each question has <strong>instant feedback</strong></li>
                    <li>• Build <strong>streaks</strong> for bonus points</li>
                    <li>• You cannot retake this quiz once submitted</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button size="lg" className="w-full text-lg py-6" onClick={handleStart} disabled={isPending}>
              {isPending ? 'Starting...' : 'Start Quiz →'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Submitting screen ─────────────────────────────────────────────
  if (finished || submitting) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="animate-pulse">
          <Trophy className="h-16 w-16 text-primary mx-auto mb-4" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Submitting your answers...</h2>
        <p className="text-muted-foreground">Calculating your score</p>
      </div>
    )
  }

  // ─── Quiz playing screen ───────────────────────────────────────────
  if (!questions || questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">No questions available</h2>
        <p className="text-muted-foreground">This quiz does not have any questions yet. Please contact your manager.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Top bar: timer, progress, streak */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            quiz.time_limit_minutes > 0 && timeRemaining < 60 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-muted'
          }`}>
            <Clock className="h-4 w-4" />
            {quiz.time_limit_minutes > 0 ? formatTime(timeRemaining) : formatTime(totalTime)}
          </div>

          {streak >= 2 && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 text-sm font-medium animate-bounce">
              <Flame className="h-4 w-4" />
              {streak} streak!
            </div>
          )}
        </div>

        <Badge variant="outline" className="text-sm">
          {currentIndex + 1} / {totalQuestions}
        </Badge>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-2" />

      {/* Question card */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs capitalize">{currentQuestion?.difficulty}</Badge>
            <span className="text-xs text-muted-foreground">Question {currentIndex + 1}</span>
          </div>
          <CardTitle className="text-xl mt-3 leading-relaxed">
            {currentQuestion?.question_text}
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 space-y-3">
          {currentQuestion?.options?.map((option: any, idx: number) => {
            const isSelected = selectedOption === idx
            const isCorrect = option.isCorrect
            let style = 'border-2 border-transparent hover:border-primary/50 cursor-pointer'

            if (showFeedback) {
              if (isCorrect) {
                style = 'border-2 border-green-500 bg-green-50 dark:bg-green-950/20'
              } else if (isSelected && !isCorrect) {
                style = 'border-2 border-red-500 bg-red-50 dark:bg-red-950/20'
              } else {
                style = 'border-2 border-transparent opacity-50'
              }
            } else if (isSelected) {
              style = 'border-2 border-primary bg-primary/5'
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                disabled={showFeedback}
                className={`w-full text-left p-4 rounded-lg transition-all ${style}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                    showFeedback && isCorrect ? 'bg-green-500 text-white'
                    : showFeedback && isSelected && !isCorrect ? 'bg-red-500 text-white'
                    : isSelected ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                  }`}>
                    {showFeedback && isCorrect ? <CheckCircle2 className="h-4 w-4" /> :
                     showFeedback && isSelected && !isCorrect ? <XCircle className="h-4 w-4" /> :
                     String.fromCharCode(65 + idx)}
                  </div>
                  <span className="text-sm">{option.text}</span>
                </div>
              </button>
            )
          })}

          {/* Feedback / Explanation */}
          {showFeedback && currentQuestion?.explanation && (
            <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Explanation</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">{currentQuestion.explanation}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex justify-between">
        <div /> {/* Spacer */}
        {!showFeedback ? (
          <Button onClick={handleConfirmAnswer} disabled={selectedOption === null} size="lg">
            Confirm Answer
            <Zap className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleNext} size="lg">
            {currentIndex + 1 >= totalQuestions ? 'Finish Quiz' : 'Next Question'}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
