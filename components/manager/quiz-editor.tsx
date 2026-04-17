'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { updateQuiz, updateQuestion, deleteQuestion, createQuestion } from '@/lib/actions/quiz'
import type { Quiz, Question, DifficultyLevel, CreateQuestionInput } from '@/lib/types/database'
import { Save, Trash2, Plus, CheckCircle2, XCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { UnifiedQuizImporter } from './unified-quiz-importer'

const DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'advanced', 'hardcore']

interface QuizEditorProps {
  quiz: Quiz
  questions: Question[]
}

export function QuizEditor({ quiz: initialQuiz, questions: initialQuestions }: QuizEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [quiz, setQuiz] = useState(initialQuiz)
  const [questions, setQuestions] = useState(initialQuestions)
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleQuizChange(field: string, value: any) {
    setQuiz((prev: any) => ({ ...prev, [field]: value }))
  }

  function handleSaveQuiz() {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const res = await updateQuiz(quiz.id, {
        title: quiz.title,
        description: quiz.description || undefined,
        topic: quiz.topic,
        difficulty: quiz.difficulty,
        time_limit_minutes: quiz.time_limit_minutes,
        question_count: quiz.question_count,
        passing_score: quiz.passing_score,
        feedback_form_url: quiz.feedback_form_url || undefined,
      })
      if (res.error) {
        setError(res.error)
      } else {
        setSuccess('Quiz updated successfully')
        setTimeout(() => setSuccess(null), 3000)
      }
    })
  }

  function handleQuestionChange(qId: string, field: string, value: any) {
    setQuestions(prev => prev.map(q => q.id === qId ? { ...q, [field]: value } : q))
  }

  function handleOptionChange(qId: string, optIndex: number, field: 'text' | 'isCorrect', value: any) {
    setQuestions(prev => prev.map(q => {
      if (q.id !== qId) return q
      const options = [...q.options]
      if (field === 'isCorrect' && value === true) {
        // Unset all others
        options.forEach((o, i) => { options[i] = { ...o, isCorrect: i === optIndex } })
      } else {
        options[optIndex] = { ...options[optIndex], [field]: value }
      }
      return { ...q, options }
    }))
  }

  function handleSaveQuestion(q: Question) {
    setError(null)
    startTransition(async () => {
      const res = await updateQuestion(q.id, {
        question_text: q.question_text,
        options: q.options,
        difficulty: q.difficulty,
        explanation: q.explanation || undefined,
      })
      if (res.error) {
        setError(res.error)
      } else {
        setSuccess('Question saved')
        setTimeout(() => setSuccess(null), 2000)
      }
    })
  }

  function handleDeleteQuestion(qId: string) {
    if (!confirm('Delete this question?')) return
    startTransition(async () => {
      const res = await deleteQuestion(qId)
      if (res.error) {
        setError(res.error)
      } else {
        setQuestions(prev => prev.filter(q => q.id !== qId))
      }
    })
  }

  function handleAddQuestion() {
    startTransition(async () => {
      const newQ: CreateQuestionInput = {
        quiz_id: quiz.id,
        question_text: 'New question',
        options: [
          { text: 'Option A', isCorrect: true },
          { text: 'Option B', isCorrect: false },
          { text: 'Option C', isCorrect: false },
          { text: 'Option D', isCorrect: false },
        ],
        difficulty: quiz.difficulty,
        status: 'pending',
      }
      const res = await createQuestion(newQ)
      if (res.error) {
        setError(res.error)
      } else if (res.data) {
        setQuestions(prev => [...prev, res.data])
        setExpandedQuestion(res.data.id)
      }
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md flex items-center gap-2">
          <XCircle className="h-4 w-4" />{error}
        </div>
      )}
      {success && (
        <div className="p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 rounded-md flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />{success}
        </div>
      )}

      {/* Quiz Details */}
      <Card>
        <CardHeader>
          <CardTitle>Quiz Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={quiz.title} onChange={e => handleQuizChange('title', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input value={quiz.topic} onChange={e => handleQuizChange('topic', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={quiz.description || ''} onChange={e => handleQuizChange('description', e.target.value)} />
          </div>

          <div className="grid gap-6 md:grid-cols-4 items-end">
            <div className="md:col-span-4 space-y-3">
              <Label className="text-base font-bold">Difficulty Level</Label>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleQuizChange('difficulty', d)}
                    className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all border-2 ${
                      quiz.difficulty === d
                        ? 'bg-foreground text-background border-foreground shadow-lg scale-105'
                        : 'bg-background text-muted-foreground border-foreground/10 hover:border-foreground/30'
                    }`}
                  >
                    {d.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground italic">
                Choose a priority level for question generation (50% will come from this level).
              </p>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">Time Limit (min)</Label>
              <Input 
                type="number" 
                className="rounded-xl h-12"
                value={quiz.time_limit_minutes} 
                onChange={e => handleQuizChange('time_limit_minutes', parseInt(e.target.value) || 0)} 
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Question Count</Label>
              <Input 
                type="number" 
                className="rounded-xl h-12"
                value={quiz.question_count} 
                onChange={e => handleQuizChange('question_count', parseInt(e.target.value) || 0)} 
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="font-bold">Passing Score (%)</Label>
              <Input 
                type="number" 
                className="rounded-xl h-12"
                value={quiz.passing_score} 
                onChange={e => handleQuizChange('passing_score', parseInt(e.target.value) || 0)} 
              />
            </div>
          </div>

          <div className="space-y-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
            <Label className="text-base font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Mandatory Feedback Form URL
            </Label>
            <Input 
              className="h-12 rounded-xl border-primary/20 bg-background focus-visible:ring-primary"
              value={quiz.feedback_form_url || ''} 
              onChange={e => handleQuizChange('feedback_form_url', e.target.value)} 
              placeholder="e.g. https://forms.google.com/..." 
            />
            <p className="text-xs text-muted-foreground">
              Employees will be required to click this link after completing the quiz to exit.
            </p>
          </div>

          {/* Quiz Scheduling */}
          <div className="space-y-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
            <Label className="text-base font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Quiz Scheduling
            </Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm">Start Date & Time</Label>
                <Input 
                  type="datetime-local"
                  className="h-12 rounded-xl"
                  value={quiz.starts_at ? new Date(quiz.starts_at).toISOString().slice(0, 16) : ''} 
                  onChange={e => handleQuizChange('starts_at', e.target.value ? new Date(e.target.value).toISOString() : null)} 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">End Date & Time (Deadline)</Label>
                <Input 
                  type="datetime-local"
                  className="h-12 rounded-xl"
                  value={quiz.ends_at ? new Date(quiz.ends_at).toISOString().slice(0, 16) : ''} 
                  onChange={e => handleQuizChange('ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)} 
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Set a deadline for the quiz. After the end date, you can import assessment data for AI analysis.
            </p>
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleSaveQuiz} 
              disabled={isPending}
              size="lg"
              className="w-full md:w-auto rounded-full px-12 h-14 bg-foreground text-background font-bold hover:scale-[1.02] transition-transform"
            >
              {isPending ? <Spinner className="mr-2" /> : <Save className="mr-2 h-5 w-5" />}
              Save All Quiz Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <div id="upload">
        <UnifiedQuizImporter
          quizId={quiz.id}
          quizTopic={quiz.topic}
          quizDifficulty={quiz.difficulty}
          onQuestionsAdded={() => {
            router.refresh()
          }}
        />
      </div>

      {/* Questions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Questions ({questions.length})</CardTitle>
          <Button size="sm" onClick={handleAddQuestion} disabled={isPending}>
            <Plus className="mr-2 h-4 w-4" /> Add Question
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No questions yet. Use the content generator above or add manually.</p>
          )}

          {questions.map((q, qi) => (
            <div key={q.id} className="border rounded-lg">
              {/* Header */}
              <button
                className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedQuestion(expandedQuestion === q.id ? null : q.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">Q{qi + 1}</span>
                  <span className="text-sm font-medium line-clamp-1">{q.question_text}</span>
                  <Badge variant="outline" className="text-[10px]">{q.difficulty}</Badge>
                  <Badge variant={q.status === 'approved' ? 'default' : q.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {q.status}
                  </Badge>
                </div>
                {expandedQuestion === q.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {/* Expanded editor */}
              {expandedQuestion === q.id && (
                <div className="p-4 border-t space-y-4">
                  <div className="space-y-2">
                    <Label>Question Text</Label>
                    <Textarea
                      value={q.question_text}
                      onChange={e => handleQuestionChange(q.id, 'question_text', e.target.value)}
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Difficulty</Label>
                      <select
                        className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                        value={q.difficulty}
                        onChange={e => handleQuestionChange(q.id, 'difficulty', e.target.value)}
                      >
                        {DIFFICULTIES.map(d => (
                          <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Explanation (shown after answer)</Label>
                      <Input
                        value={q.explanation || ''}
                        onChange={e => handleQuestionChange(q.id, 'explanation', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Options (click radio to set correct answer)</Label>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-3">
                        <button
                          type="button"
                          className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                            opt.isCorrect
                              ? 'border-green-500 bg-green-500'
                              : 'border-muted-foreground hover:border-green-400'
                          }`}
                          onClick={() => handleOptionChange(q.id, oi, 'isCorrect', true)}
                        >
                          {opt.isCorrect && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </button>
                        <span className="text-sm font-medium w-6">{String.fromCharCode(65 + oi)}.</span>
                        <Input
                          value={opt.text}
                          onChange={e => handleOptionChange(q.id, oi, 'text', e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button size="sm" onClick={() => handleSaveQuestion(q)} disabled={isPending}>
                      <Save className="mr-1 h-3 w-3" /> Save
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteQuestion(q.id)} disabled={isPending}>
                      <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Back button */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => router.push(`/manager/quizzes/${quiz.id}`)}>
          Back to Quiz
        </Button>
      </div>
    </div>
  )
}
