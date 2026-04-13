'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel, FieldMessage } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { createQuiz } from '@/lib/actions/quiz'
import { ArrowLeft, Sparkles, Wand2 } from 'lucide-react'
import Link from 'next/link'
import type { DifficultyLevel } from '@/lib/types/database'

const ALL_DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'advanced', 'hardcore']

function getDistribution(primary: DifficultyLevel, total: number) {
  const primaryCount = Math.ceil(total * 0.5)
  const remaining = total - primaryCount
  const others = ALL_DIFFICULTIES.filter(d => d !== primary)
  const perOther = Math.floor(remaining / others.length)
  let leftover = remaining - (perOther * others.length)
  const dist: Record<string, number> = { [primary]: primaryCount }
  for (const d of others) {
    dist[d] = perOther + (leftover > 0 ? 1 : 0)
    if (leftover > 0) leftover--
  }
  return dist
}

export default function NewQuizPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium')
  const [questionCount, setQuestionCount] = useState(10)
  const [topic, setTopic] = useState('')

  const distribution = useMemo(() => getDistribution(difficulty, questionCount), [difficulty, questionCount])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = new FormData(e.currentTarget)
    const data = {
      title: form.get('title') as string,
      description: form.get('description') as string || undefined,
      topic: form.get('topic') as string,
      difficulty,
      time_limit_minutes: parseInt(form.get('time_limit_minutes') as string) || 30,
      question_count: questionCount,
      passing_score: parseInt(form.get('passing_score') as string) || 60,
      feedback_form_url: form.get('feedback_form_url') as string || undefined,
    }

    startTransition(async () => {
      const result = await createQuiz(data as any)
      if (result.error) {
        setError(result.error)
        return
      }

      const quizId = result.data?.id

      // Auto-generate questions if requested
      if (quizId && form.get('auto_generate') === 'on') {
        setIsGenerating(true)
        try {
          await fetch('/api/generate-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              quiz_id: quizId,
              topic: data.topic,
              difficulty,
              count: questionCount,
            }),
          })
        } catch (err) {
          // Continue even if generation fails
        }
        setIsGenerating(false)
      }

      router.push(`/manager/quizzes`)
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/manager/quizzes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Quiz</h1>
          <p className="text-muted-foreground">Set up a new employee assessment</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Quiz Details</CardTitle>
            <CardDescription>Define the topic, difficulty, and parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
            )}

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input id="title" name="title" placeholder="e.g., JavaScript Fundamentals" required />
              </Field>

              <Field>
                <FieldLabel htmlFor="description">Description (Optional)</FieldLabel>
                <Textarea id="description" name="description" placeholder="Brief description of this assessment..." rows={3} />
              </Field>

              <Field>
                <FieldLabel htmlFor="topic">Topic</FieldLabel>
                <Input id="topic" name="topic" placeholder="e.g., React, Python, Data Structures" required value={topic} onChange={e => setTopic(e.target.value)} />
                <FieldMessage>Topic used for dynamic question generation</FieldMessage>
              </Field>

              <Field>
                <FieldLabel>Primary Difficulty</FieldLabel>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as DifficultyLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_DIFFICULTIES.map(d => (
                      <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldMessage>50% of questions will be at this difficulty; 10% each from others</FieldMessage>
              </Field>

              {/* Distribution preview */}
              <div className="p-4 rounded-lg bg-muted space-y-2">
                <p className="text-sm font-medium">Question Distribution Preview</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_DIFFICULTIES.map(d => (
                    <Badge key={d} variant={d === difficulty ? 'default' : 'outline'} className="text-xs capitalize">
                      {d}: {distribution[d] || 0} ({d === difficulty ? '50%' : '~10%'})
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Total: {questionCount} questions</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="question_count">Number of Questions</FieldLabel>
                  <Input id="question_count" name="question_count" type="number" min={1} max={100} value={questionCount} onChange={e => setQuestionCount(parseInt(e.target.value) || 10)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="time_limit_minutes">Time Limit (minutes)</FieldLabel>
                  <Input id="time_limit_minutes" name="time_limit_minutes" type="number" min={1} max={480} defaultValue={30} />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="passing_score">Passing Score (%)</FieldLabel>
                <Input id="passing_score" name="passing_score" type="number" min={0} max={100} defaultValue={60} />
              </Field>

              <Field>
                <FieldLabel htmlFor="feedback_form_url">Feedback Form URL (Optional)</FieldLabel>
                <Input id="feedback_form_url" name="feedback_form_url" type="url" placeholder="https://forms.google.com/..." />
                <FieldMessage>Displayed to employees after quiz completion</FieldMessage>
              </Field>

              <div className="flex items-center gap-3 p-4 rounded-lg border bg-primary/5">
                <input type="checkbox" id="auto_generate" name="auto_generate" defaultChecked className="rounded" />
                <label htmlFor="auto_generate" className="flex items-center gap-2 cursor-pointer">
                  <Wand2 className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Auto-generate questions</p>
                    <p className="text-xs text-muted-foreground">Use AI to generate MCQs based on the topic and difficulty distribution</p>
                  </div>
                </label>
              </div>
            </FieldGroup>

            <Button type="submit" className="w-full" disabled={isPending || isGenerating}>
              {isPending || isGenerating ? <Spinner className="mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {isGenerating ? 'Generating Questions...' : isPending ? 'Creating...' : 'Create Quiz'}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
