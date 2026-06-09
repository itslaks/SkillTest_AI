'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/hooks/use-toast'
import { createQuiz, bulkCreateQuestions, deleteQuiz, saveQuizCertificateRule } from '@/lib/actions/quiz'
import {
  ArrowLeft, Sparkles, Wand2, Upload, FileSpreadsheet, Download,
  CheckCircle2, Clock, Target, AlarmClock,
  Eye, Hash, BookOpen, Zap, ChevronRight,
  Award, Info, XCircle, Settings2, FileUp, ShieldAlert,
} from 'lucide-react'
import type { DifficultyLevel, ParsedQuestion } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { parseUniversalRowsFile, UNIVERSAL_UPLOAD_ACCEPT, normalizeHeader } from '@/lib/file-utils'
import { AISetupInstructions } from '@/components/manager/ai-setup-instructions'
import { SafeBackButton } from '@/components/navigation/safe-back-button'

const ALL_DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'advanced', 'hardcore']

const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  easy: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20',
  medium: 'bg-blue-500/10 text-blue-700 border-blue-200 hover:bg-blue-500/20',
  hard: 'bg-amber-500/10 text-amber-700 border-amber-200 hover:bg-amber-500/20',
  advanced: 'bg-orange-500/10 text-orange-700 border-orange-200 hover:bg-orange-500/20',
  hardcore: 'bg-red-500/10 text-red-700 border-red-200 hover:bg-red-500/20',
}

const DIFFICULTY_ACTIVE: Record<DifficultyLevel, string> = {
  easy: 'bg-emerald-500 text-white border-emerald-500',
  medium: 'bg-blue-500 text-white border-blue-500',
  hard: 'bg-amber-500 text-white border-amber-500',
  advanced: 'bg-orange-500 text-white border-orange-500',
  hardcore: 'bg-red-500 text-white border-red-500',
}

const TOPIC_PRESETS = [
  'JavaScript', 'Python', 'React', 'SQL', 'Data Structures',
  'Machine Learning', 'Cybersecurity', 'Excel', 'Leadership', 'Communication',
]

function getDistribution(primary: DifficultyLevel, total: number) {
  const primaryCount = Math.ceil(total * 0.7)
  const remaining = total - primaryCount
  const primaryIndex = ALL_DIFFICULTIES.indexOf(primary)
  const adjacentDifficulties = ALL_DIFFICULTIES.filter((d, i) => d !== primary && Math.abs(i - primaryIndex) <= 2)
  const perOther = Math.floor(remaining / adjacentDifficulties.length)
  let leftover = remaining - perOther * adjacentDifficulties.length
  const dist: Record<string, number> = { [primary]: primaryCount }
  for (const d of adjacentDifficulties) {
    dist[d] = perOther + (leftover-- > 0 ? 1 : 0)
  }
  for (const d of ALL_DIFFICULTIES) if (!(d in dist)) dist[d] = 0
  return dist
}

export default function NewQuizPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'basics' | 'settings' | 'questions'>('basics')

  // Basics
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium')
  const [questionCount, setQuestionCount] = useState(10)
  const [topic, setTopic] = useState('')

  // Settings
  const [passingScore, setPassingScore] = useState(60)
  const [timeLimit, setTimeLimit] = useState(30)
  const [showResults, setShowResults] = useState(true)
  const [allowRetakes, setAllowRetakes] = useState(false)
  const [maxRetakes, setMaxRetakes] = useState(1)
  const [showExplanations, setShowExplanations] = useState(true)
  const [feedbackFormUrl, setFeedbackFormUrl] = useState('')
  const [proctoringRequired, setProctoringRequired] = useState(false)
  const [certificateEnabled, setCertificateEnabled] = useState(false)
  const [certificateTitle, setCertificateTitle] = useState('Certificate of Achievement')
  const [certificateName, setCertificateName] = useState('Course Completion Certificate')
  const [certificateMessage, setCertificateMessage] = useState('Awarded for successful course completion.')
  const [certificateAccent, setCertificateAccent] = useState('#d97706')
  const [certificateNotes, setCertificateNotes] = useState('Employee name, course name, score, and issue date are rendered automatically.')
  const [certificateTemplateFile, setCertificateTemplateFile] = useState<File | null>(null)

  // Questions
  const [questionSource, setQuestionSource] = useState<'ai' | 'upload' | 'both'>('ai')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([])
  const [extractedUploadContent, setExtractedUploadContent] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null) // null = loading, true/false = available
  const fileInputRef = useRef<HTMLInputElement>(null)

  const distribution = useMemo(() => getDistribution(difficulty, questionCount), [difficulty, questionCount])

  // Check AI availability on mount
  useEffect(() => {
    async function checkAIAvailability() {
      try {
        const response = await fetch('/api/ai-status')
        const result = await response.json()
        setAiAvailable(result.hasAnyAI)
      } catch {
        setAiAvailable(false)
      }
    }
    checkAIAvailability()
  }, [])

  const sectionComplete = {
    basics: !!topic && !!title,
    settings: true,
    questions: questionSource === 'ai' || parsedQuestions.length > 0 || !!extractedUploadContent,
  }

  async function handleFileUpload(file: File) {
    setUploadError(null)
    setUploadedFile(file)
    setParsedQuestions([])
    setExtractedUploadContent('')

    try {
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.pdf') || fileName.endsWith('.docx')) {
        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/extract-content', { method: 'POST', body: formData })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to extract document text')
        setExtractedUploadContent(result.text)
        toast({
          title: 'Document Ready',
          description: `Extracted ${result.wordCount} words. AI will convert it into questions.`,
        })
        return
      }

      const rows = await parseUniversalRowsFile(file) as any[]

      const questions = rows.map((r: any) => ({
        question_text: rowCell(r, ['question_text', 'Question', 'question', 'prompt']),
        option_a: rowCell(r, ['option_a', 'Option A', 'A', 'choice_a', 'answer_a']),
        option_b: rowCell(r, ['option_b', 'Option B', 'B', 'choice_b', 'answer_b']),
        option_c: rowCell(r, ['option_c', 'Option C', 'C', 'choice_c', 'answer_c']),
        option_d: rowCell(r, ['option_d', 'Option D', 'D', 'choice_d', 'answer_d']),
        correct_answer: rowCell(r, ['correct_answer', 'Correct Answer', 'Answer', 'answer', 'key']) || 'a',
        difficulty: normalizeDifficulty(rowCell(r, ['difficulty', 'Difficulty', 'level']), difficulty),
        explanation: rowCell(r, ['explanation', 'Explanation', 'reason', 'rationale']),
      })).filter((q: any) => q.question_text)
      if (questions.length === 0) throw new Error('No valid questions found. Check column headers.')
      setParsedQuestions(questions)
    } catch (err: any) {
      setUploadError(err.message || 'Failed to parse file')
      setUploadedFile(null)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const data: any = {
      title,
      description: description || undefined,
      topic,
      difficulty,
      time_limit_minutes: timeLimit,
      question_count: questionCount,
      passing_score: passingScore,
      feedback_form_url: feedbackFormUrl || undefined,
      proctoring_required: proctoringRequired,
      status: 'active', // Ensure quiz is active immediately
    }

    startTransition(async () => {
      const result = await createQuiz(data)
      if (result.error) { setError(result.error); return }
      const quizId = result.data?.id

      if (quizId) {
        const cleanupQuiz = async (reason: string) => {
          await deleteQuiz(quizId)
          setError(`Quiz creation rolled back: ${reason}`)
        }

        try {
          const certificateForm = new FormData()
          certificateForm.set('quiz_id', quizId)
          if (certificateEnabled) certificateForm.set('enabled', 'on')
          certificateForm.set('min_score', String(passingScore))
          certificateForm.set('title', certificateTitle)
          certificateForm.set('certificate_name', certificateName)
          certificateForm.set('message', certificateMessage)
          certificateForm.set('template_accent_color', certificateAccent)
          certificateForm.set('template_notes', certificateNotes)
          if (certificateTemplateFile) certificateForm.set('template_file', certificateTemplateFile)
          const certificateResult = await saveQuizCertificateRule(certificateForm)
          if (certificateResult.error) {
            await cleanupQuiz(certificateResult.error)
            return
          }

          if ((questionSource === 'upload' || questionSource === 'both') && parsedQuestions.length > 0) {
            const invalidRows: number[] = []
            const questionInputs = parsedQuestions.flatMap((q, index) => {
              const options = [q.option_a, q.option_b, q.option_c, q.option_d]
              const correctIndex = normalizeCorrectAnswer(q.correct_answer || '', options)
              if (correctIndex === -1) {
                invalidRows.push(index + 1)
                return []
              }

              return [{
                quiz_id: quizId,
                question_text: q.question_text,
                options: options.map((text, optionIndex) => ({
                  text,
                  isCorrect: optionIndex === correctIndex,
                })),
                difficulty: (q.difficulty || difficulty) as DifficultyLevel,
                explanation: q.explanation || undefined,
              }]
            })

            if (invalidRows.length > 0) {
              toast({
                title: 'Invalid correct answers skipped',
                description: `Rows ${invalidRows.join(', ')} do not match A-D or the exact option text.`,
                variant: 'destructive',
              })
            }

            if (questionInputs.length === 0) {
              await cleanupQuiz('No uploaded questions had a valid correct answer.')
              return
            }

            const questionResult = await bulkCreateQuestions(questionInputs)
            if (questionResult.error) {
              await cleanupQuiz(questionResult.error)
              return
            }
          }

          if ((questionSource === 'upload' || questionSource === 'both') && extractedUploadContent) {
            if (aiAvailable === false) {
              await cleanupQuiz('Document upload requires AI question generation, but AI is not configured.')
              return
            }

            const response = await fetch('/api/generate-from-content', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                quiz_id: quizId,
                content: extractedUploadContent,
                difficulty,
                count: questionCount,
                topic,
              }),
            })

            const result = await response.json()
            if (!response.ok) {
              await cleanupQuiz(result.error || 'Failed to generate questions from uploaded document')
              return
            }

            toast({
              title: 'Document Questions Generated',
              description: `Created ${result.generated} questions from ${uploadedFile?.name || 'the uploaded document'}.`,
            })
          }

          if (questionSource === 'ai' || questionSource === 'both') {
            if (aiAvailable === false) {
              await cleanupQuiz('AI question generation is not available. Please configure your API keys in .env.local.')
              return
            }

            setIsGenerating(true)
            try {
              const response = await fetch('/api/generate-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quiz_id: quizId, topic, difficulty, count: questionCount }),
              })

              const result = await response.json()
              if (!response.ok) {
                throw new Error(result.error || 'Failed to generate questions')
              }

              toast({
                title: 'Questions Generated! 🎉',
                description: result.success || `Successfully generated ${result.generated} questions using ${result.method}`,
              })
            } catch (error) {
              console.error('AI question generation failed:', error)
              await cleanupQuiz(error instanceof Error ? error.message : 'Failed to generate AI questions')
              return
            } finally {
              setIsGenerating(false)
            }
          }
        } catch (error: any) {
          console.error('Quiz creation failed after initial save:', error)
          await cleanupQuiz(error?.message || 'Unexpected failure while creating quiz questions')
          return
        }
      }

      router.push(`/manager/quizzes/${quizId}?assign=1`)
    })
  }

  const sections = [
    { id: 'basics', label: 'Quiz Basics', icon: BookOpen },
    { id: 'settings', label: 'Settings & Rules', icon: Settings2 },
    { id: 'questions', label: 'Add Questions', icon: FileUp },
  ] as const

  return (
    <div className="max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center gap-4 mb-8">
        <SafeBackButton fallbackHref="/manager/quizzes" size="icon" className="rounded-xl">
          <ArrowLeft className="h-4 w-4" />
        </SafeBackButton>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Quiz</h1>
          <p className="text-sm text-muted-foreground">Set up your employee assessment in 3 easy steps</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8 rounded-2xl border border-border/60 overflow-hidden bg-white shadow-sm">
        {sections.map((section, i) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className={cn(
              'flex-1 flex items-center gap-3 px-5 py-4 text-sm font-medium transition-all relative',
              i < sections.length - 1 ? 'border-r border-border/60' : '',
              activeSection === section.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            )}
          >
            <section.icon className="h-4 w-4 shrink-0" />
            <div className="text-left hidden sm:block">
              <p className="text-xs opacity-60 mb-0.5">Step {i + 1}</p>
              <p>{section.label}</p>
            </div>
            {sectionComplete[section.id] && activeSection !== section.id && (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
            )}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-700">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* ── SECTION 1: BASICS ── */}
        {activeSection === 'basics' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50 bg-muted/20">
                <h2 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Quiz Basics</h2>
                <p className="text-xs text-muted-foreground mt-0.5">What is this quiz about?</p>
              </div>
              <div className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Quiz Title <span className="text-red-500">*</span></label>
                  <Input name="title" placeholder="e.g., JavaScript Fundamentals Q1 2026" required value={title} onChange={e => setTitle(e.target.value)} className="h-11 rounded-xl" />
                  <p className="text-xs text-muted-foreground">This will be visible to employees</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Textarea name="description" placeholder="Give employees a brief overview of what this quiz covers..." rows={3} value={description} onChange={e => setDescription(e.target.value)} className="rounded-xl resize-none" />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Topic / Subject <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="e.g., React Hooks, Excel Formulas, Safety Procedures"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    required
                    className="h-11 rounded-xl"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {TOPIC_PRESETS.map(t => (
                      <button
                        key={t} type="button"
                        onClick={() => setTopic(t)}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-full border transition-all',
                          topic === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        )}
                      >{t}</button>
                    ))}
                  </div>
                </div>

                {/* Difficulty picker */}
                <div className="space-y-2.5">
                  <label className="text-sm font-medium">Difficulty Level</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_DIFFICULTIES.map(d => (
                      <button
                        key={d} type="button"
                        onClick={() => setDifficulty(d)}
                        className={cn(
                          'px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                          difficulty === d ? DIFFICULTY_ACTIVE[d] : DIFFICULTY_COLORS[d]
                        )}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Primary difficulty — 70% of questions will be at this level</p>
                </div>

                {/* Distribution bar */}
                <div className="rounded-xl border border-border/60 p-4 bg-muted/20 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Question Distribution</p>
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                    {ALL_DIFFICULTIES.map((d) => {
                      const pct = distribution[d] ? (distribution[d] / questionCount) * 100 : 0
                      const colors: Record<string, string> = { easy: 'bg-emerald-400', medium: 'bg-blue-400', hard: 'bg-amber-400', advanced: 'bg-orange-400', hardcore: 'bg-red-400' }
                      return pct > 0 ? <div key={d} className={cn('transition-all', colors[d])} style={{ width: `${pct}%` }} title={`${d}: ${distribution[d]}`} /> : null
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ALL_DIFFICULTIES.map(d => (
                      <span key={d} className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium', difficulty === d ? DIFFICULTY_ACTIVE[d] : 'bg-muted text-muted-foreground border-transparent')}>
                        {d}: {distribution[d] || 0}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Count + time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-muted-foreground" />Questions</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setQuestionCount(Math.max(1, questionCount - 5))} className="w-9 h-11 rounded-xl border border-border hover:bg-muted text-lg font-bold flex items-center justify-center">−</button>
                      <Input type="number" min={1} max={100} value={questionCount} onChange={e => setQuestionCount(parseInt(e.target.value) || 10)} className="h-11 rounded-xl text-center font-bold text-lg flex-1" />
                      <button type="button" onClick={() => setQuestionCount(Math.min(100, questionCount + 5))} className="w-9 h-11 rounded-xl border border-border hover:bg-muted text-lg font-bold flex items-center justify-center">+</button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" />Time (minutes)</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setTimeLimit(Math.max(1, timeLimit - 5))} className="w-9 h-11 rounded-xl border border-border hover:bg-muted text-lg font-bold flex items-center justify-center">−</button>
                      <Input type="number" min={1} max={480} value={timeLimit} onChange={e => setTimeLimit(parseInt(e.target.value) || 30)} className="h-11 rounded-xl text-center font-bold text-lg flex-1" />
                      <button type="button" onClick={() => setTimeLimit(Math.min(480, timeLimit + 5))} className="w-9 h-11 rounded-xl border border-border hover:bg-muted text-lg font-bold flex items-center justify-center">+</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button type="button" onClick={() => setActiveSection('settings')} className="w-full flex items-center justify-between px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity shadow-sm">
              <span>Next: Settings & Rules</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* ── SECTION 2: SETTINGS ── */}
        {activeSection === 'settings' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50 bg-muted/20">
                <h2 className="font-semibold flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> Settings & Rules</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Control how employees experience this quiz</p>
              </div>
              <div className="p-6 space-y-6">
                {/* Passing score */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2"><Target className="h-4 w-4 text-emerald-500" />Passing Score</label>
                    <span className="text-2xl font-bold text-emerald-600">{passingScore}%</span>
                  </div>
                  <input
                    type="range" min={0} max={100} step={5}
                    value={passingScore}
                    onChange={e => setPassingScore(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-2 rounded-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0% (Easy)</span><span>50%</span><span>100% (Strict)</span>
                  </div>
                </div>

                <hr className="border-border/60" />

                {/* Toggle grid */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">Quiz Behavior</p>
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-emerald-800">Automatic randomization is enabled</p>
                      <p className="text-xs text-emerald-700">Questions and answer options are shuffled for every employee attempt.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'show_results', icon: Eye, label: 'Show Results', desc: 'Display score after completion', value: showResults, set: setShowResults },
                      { id: 'show_explain', icon: BookOpen, label: 'Show Explanations', desc: 'Show correct answers after quiz', value: showExplanations, set: setShowExplanations },
                      { id: 'allow_retakes', icon: AlarmClock, label: 'Allow Retakes', desc: 'Let employees redo the quiz', value: allowRetakes, set: setAllowRetakes },
                    ].map(opt => (
                      <button
                        key={opt.id} type="button"
                        onClick={() => opt.set(!opt.value)}
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-xl border text-left transition-all',
                          opt.value ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-border/80 bg-muted/20'
                        )}
                      >
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                          <opt.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        <div className={cn('w-9 h-5 rounded-full transition-colors relative shrink-0', opt.value ? 'bg-primary' : 'bg-muted')}>
                          <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all', opt.value ? 'left-4' : 'left-0.5')} />
                        </div>
                      </button>
                  ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setProctoringRequired(!proctoringRequired)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-4 text-left transition-all',
                      proctoringRequired ? 'border-red-300 bg-red-50' : 'border-border bg-muted/20 hover:border-border/80'
                    )}
                  >
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', proctoringRequired ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground')}>
                      <ShieldAlert className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Enable AI Proctoring</p>
                      <p className="text-xs text-muted-foreground">Requires camera access and fullscreen mode before employees can start.</p>
                    </div>
                    <div className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', proctoringRequired ? 'bg-red-600' : 'bg-muted')}>
                      <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all', proctoringRequired ? 'left-4' : 'left-0.5')} />
                    </div>
                  </button>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <button
                      type="button"
                      onClick={() => setCertificateEnabled(!certificateEnabled)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', certificateEnabled ? 'bg-amber-600 text-white' : 'bg-white text-amber-700')}>
                        <Award className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-amber-950">Enable Certificate</p>
                        <p className="text-xs text-amber-800">Certificates are issued only after the attempt is clear or approved.</p>
                      </div>
                      <div className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', certificateEnabled ? 'bg-amber-600' : 'bg-amber-200')}>
                        <div className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all', certificateEnabled ? 'left-4' : 'left-0.5')} />
                      </div>
                    </button>
                    {!certificateEnabled && (
                      <p className="mt-3 text-xs text-amber-700">Toggle on to configure certificate details — title, message, threshold, and template image.</p>
                    )}
                    {certificateEnabled && <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-amber-950">Certificate Title</label>
                        <Input value={certificateTitle} onChange={(event) => setCertificateTitle(event.target.value)} className="h-10 rounded-xl bg-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-amber-950">Template Name</label>
                        <Input value={certificateName} onChange={(event) => setCertificateName(event.target.value)} className="h-10 rounded-xl bg-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-amber-950">Certificate Threshold</label>
                        <Input type="number" min={0} max={100} value={passingScore} onChange={(event) => setPassingScore(Number(event.target.value) || 0)} className="h-10 rounded-xl bg-white" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-amber-950">Accent Color</label>
                        <Input type="color" value={certificateAccent} onChange={(event) => setCertificateAccent(event.target.value)} className="h-10 rounded-xl bg-white p-1" />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-semibold text-amber-950">Message</label>
                        <Input value={certificateMessage} onChange={(event) => setCertificateMessage(event.target.value)} className="h-10 rounded-xl bg-white" />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-semibold text-amber-950">Validity / Template Notes</label>
                        <Input value={certificateNotes} onChange={(event) => setCertificateNotes(event.target.value)} className="h-10 rounded-xl bg-white" />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-xs font-semibold text-amber-950">Certificate Template Image</label>
                        <Input type="file" accept="image/*" onChange={(event) => setCertificateTemplateFile(event.target.files?.[0] || null)} className="h-10 rounded-xl bg-white" />
                      </div>
                    </div>}
                  </div>

                  {allowRetakes && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
                      <AlarmClock className="h-4 w-4 text-amber-600 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-800">Max Retakes</p>
                        <p className="text-xs text-amber-600">0 = unlimited</p>
                      </div>
                      <Input type="number" min={0} max={10} value={maxRetakes} onChange={e => setMaxRetakes(parseInt(e.target.value) || 0)} className="w-20 h-8 rounded-lg text-center font-bold" />
                    </div>
                  )}
                </div>

                <hr className="border-border/60" />

                {/* Feedback URL */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    Feedback Form URL <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <Input name="feedback_form_url" type="url" placeholder="https://forms.google.com/..." value={feedbackFormUrl} onChange={e => setFeedbackFormUrl(e.target.value)} className="h-11 rounded-xl" />
                  <p className="text-xs text-muted-foreground">Displayed to employees after quiz completion</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setActiveSection('basics')} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border border-border font-semibold hover:bg-muted transition-colors text-sm">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button type="button" onClick={() => setActiveSection('questions')} className="flex-[2] flex items-center justify-between px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity shadow-sm">
                <span>Next: Add Questions</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* ── SECTION 3: QUESTIONS ── */}
        {activeSection === 'questions' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50 bg-muted/20">
                <h2 className="font-semibold flex items-center gap-2"><FileUp className="h-4 w-4 text-primary" /> Add Questions</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Choose how to populate your quiz</p>
              </div>
              <div className="p-6 space-y-5">
                {/* Source picker */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'ai', icon: Wand2, label: 'AI Generate', desc: 'Auto-create from topic', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', activeBg: 'bg-violet-500' },
                    { id: 'upload', icon: Upload, label: 'Upload File', desc: 'Excel, JSON, PDF, DOCX', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', activeBg: 'bg-blue-500' },
                    { id: 'both', icon: Zap, label: 'Both', desc: 'Combine AI + upload', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', activeBg: 'bg-amber-500' },
                  ].map(opt => (
                    <button
                      key={opt.id} type="button"
                      onClick={() => setQuestionSource(opt.id as any)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                        questionSource === opt.id
                          ? `${opt.border} ${opt.bg}`
                          : 'border-border hover:border-border/80 bg-white'
                      )}
                    >
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', questionSource === opt.id ? opt.bg : 'bg-muted')}>
                        <opt.icon className={cn('h-5 w-5', questionSource === opt.id ? opt.color : 'text-muted-foreground')} />
                      </div>
                      <div>
                        <p className={cn('text-sm font-semibold', questionSource === opt.id ? opt.color : 'text-foreground')}>{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* AI info and setup */}
                {(questionSource === 'ai' || questionSource === 'both') && (
                  <div className="space-y-4">
                    {aiAvailable === false ? (
                      <AISetupInstructions />
                    ) : aiAvailable === true ? (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-50 border border-violet-100">
                        <Sparkles className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-violet-800">AI will generate {questionCount} questions on "{topic || 'your topic'}"</p>
                          <p className="text-xs text-violet-600 mt-0.5">Based on your difficulty settings: {Object.entries(distribution).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ')}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border">
                        <Sparkles className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">Checking AI availability...</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload zone */}
                {(questionSource === 'upload' || questionSource === 'both') && (
                  <div className="space-y-3">
                    <input ref={fileInputRef} type="file" accept={UNIVERSAL_UPLOAD_ACCEPT} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />

                    {/* Template download */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-blue-800 font-medium">Download the question template first</span>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg border-blue-200 text-blue-700 hover:bg-blue-100 bg-white" asChild>
                        <a href="/templates/quiz-questions-template.xlsx" download>
                          <Download className="h-3.5 w-3.5 mr-1.5" />Template
                        </a>
                      </Button>
                    </div>

                    <div
                      className={cn(
                        'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5',
                        uploadedFile ? 'border-emerald-300 bg-emerald-50' : 'border-border'
                      )}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
                    >
                      {uploadedFile ? (
                        <div className="space-y-2">
                          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                          <p className="font-semibold text-emerald-700">{uploadedFile.name}</p>
                          <p className="text-sm text-emerald-600">
                            {extractedUploadContent ? 'Document ready for AI question generation' : `${parsedQuestions.length} questions ready to import`}
                          </p>
                          <button type="button" onClick={e => { e.stopPropagation(); setUploadedFile(null); setParsedQuestions([]); setExtractedUploadContent('') }} className="text-xs text-muted-foreground hover:text-destructive underline">Remove</button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                          <p className="font-medium text-sm">Drop CSV, XLSX, DOCX, PDF, XML, or JSON here</p>
                          <p className="text-xs text-muted-foreground">Structured files import directly; documents are converted into questions with AI.</p>
                        </div>
                      )}
                    </div>

                    {uploadError && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                        <XCircle className="h-4 w-4 shrink-0" />{uploadError}
                      </div>
                    )}

                    {parsedQuestions.length > 0 && (
                      <div className="rounded-xl border border-border/60 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/50">
                          <p className="text-sm font-medium">{parsedQuestions.length} questions preview</p>
                          <Badge variant="secondary" className="rounded-full text-xs">Ready</Badge>
                        </div>
                        <div className="divide-y divide-border/40 max-h-48 overflow-y-auto">
                          {parsedQuestions.slice(0, 5).map((q, i) => (
                            <div key={i} className="px-4 py-2.5 text-sm flex items-start gap-3">
                              <span className="text-xs text-muted-foreground w-5 shrink-0 pt-0.5">Q{i+1}</span>
                              <span className="flex-1 text-foreground line-clamp-1">{q.question_text}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">{q.difficulty || difficulty}</Badge>
                            </div>
                          ))}
                          {parsedQuestions.length > 5 && (
                            <div className="px-4 py-2 text-xs text-muted-foreground text-center">+{parsedQuestions.length - 5} more questions</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Summary card */}
            <div className="rounded-2xl border border-border/60 bg-white shadow-sm p-5">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Info className="h-4 w-4 text-blue-500" />Quiz Summary</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[
                  { label: 'Questions', value: questionCount, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Time Limit', value: `${timeLimit}m`, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Pass Score', value: `${passingScore}%`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Difficulty', value: difficulty, color: 'text-violet-600', bg: 'bg-violet-50' },
                  { label: 'Proctoring', value: proctoringRequired ? 'On' : 'Off', color: proctoringRequired ? 'text-red-600' : 'text-zinc-600', bg: proctoringRequired ? 'bg-red-50' : 'bg-zinc-50' },
                ].map(s => (
                  <div key={s.label} className={cn('rounded-xl p-3', s.bg)}>
                    <p className={cn('text-lg font-bold capitalize', s.color)}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setActiveSection('settings')} className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border border-border font-semibold hover:bg-muted transition-colors text-sm">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <Button
                type="submit"
                disabled={isPending || isGenerating || !topic || !title}
                className="flex-1 h-14 rounded-2xl text-[15px] font-bold shadow-lg"
              >
                {isPending || isGenerating ? (
                  <><Spinner className="mr-2" />{isGenerating ? 'Generating questions…' : 'Creating quiz…'}</>
                ) : (
                  <><Sparkles className="mr-2 h-5 w-5" />Create Quiz</>
                )}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

function rowCell(row: Record<string, any>, aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader))
  const key = Object.keys(row).find((candidate) => normalizedAliases.has(normalizeHeader(candidate)))
  const value = key ? row[key] : undefined
  return value === null || value === undefined ? '' : String(value).trim()
}

function normalizeDifficulty(value: string, fallback: DifficultyLevel): DifficultyLevel {
  const normalized = value.toLowerCase() as DifficultyLevel
  return ALL_DIFFICULTIES.includes(normalized) ? normalized : fallback
}

function normalizeCorrectAnswer(raw: string, options: string[]) {
  const value = raw.trim().toLowerCase()
  const letter = ['a', 'b', 'c', 'd'].indexOf(value)
  if (letter >= 0) return letter
  return options.findIndex((option) => option.trim().toLowerCase() === value)
}
