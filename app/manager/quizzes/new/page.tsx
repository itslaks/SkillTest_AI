'use client'

import { useState, useTransition, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { createQuiz, bulkCreateQuestions } from '@/lib/actions/quiz'
import {
  ArrowLeft, Sparkles, Wand2, Upload, FileSpreadsheet, Download,
  CheckCircle2, Clock, Target, Users, Lock, Globe, AlarmClock,
  Shuffle, Eye, EyeOff, Hash, BookOpen, Zap, ChevronRight,
  Info, XCircle, GraduationCap, Settings2, FileUp,
} from 'lucide-react'
import Link from 'next/link'
import type { DifficultyLevel } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

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

interface ParsedQuestion {
  question_text: string; option_a: string; option_b: string;
  option_c: string; option_d: string; correct_answer: string;
  difficulty?: DifficultyLevel; explanation?: string
}

export default function NewQuizPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'basics' | 'settings' | 'questions'>('basics')

  // Basics
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium')
  const [questionCount, setQuestionCount] = useState(10)
  const [topic, setTopic] = useState('')

  // Settings
  const [passingScore, setPassingScore] = useState(60)
  const [timeLimit, setTimeLimit] = useState(30)
  const [isPublic, setIsPublic] = useState(true)
  const [shuffleQuestions, setShuffleQuestions] = useState(false)
  const [shuffleOptions, setShuffleOptions] = useState(false)
  const [showResults, setShowResults] = useState(true)
  const [allowRetakes, setAllowRetakes] = useState(false)
  const [maxRetakes, setMaxRetakes] = useState(1)
  const [showExplanations, setShowExplanations] = useState(true)

  // Questions
  const [questionSource, setQuestionSource] = useState<'ai' | 'upload' | 'both'>('ai')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const distribution = useMemo(() => getDistribution(difficulty, questionCount), [difficulty, questionCount])

  const sectionComplete = {
    basics: !!topic,
    settings: true,
    questions: questionSource === 'ai' || parsedQuestions.length > 0,
  }

  function handleFileUpload(file: File) {
    setUploadError(null)
    setUploadedFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet) as any[]
        const questions = rows.map((r: any) => ({
          question_text: r['question_text'] || r['Question'] || '',
          option_a: r['option_a'] || r['Option A'] || '',
          option_b: r['option_b'] || r['Option B'] || '',
          option_c: r['option_c'] || r['Option C'] || '',
          option_d: r['option_d'] || r['Option D'] || '',
          correct_answer: r['correct_answer'] || r['Correct Answer'] || 'a',
          difficulty: r['difficulty'] || r['Difficulty'] || difficulty,
          explanation: r['explanation'] || r['Explanation'] || '',
        })).filter((q: any) => q.question_text)
        if (questions.length === 0) throw new Error('No valid questions found. Check column headers.')
        setParsedQuestions(questions)
      } catch (err: any) {
        setUploadError(err.message || 'Failed to parse file')
        setUploadedFile(null)
      }
    }
    reader.readAsBinaryString(file)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)

    const data: any = {
      title: form.get('title') as string,
      description: form.get('description') as string || undefined,
      topic,
      difficulty,
      time_limit_minutes: timeLimit,
      question_count: questionCount,
      passing_score: passingScore,
      feedback_form_url: form.get('feedback_form_url') as string || undefined,
    }

    startTransition(async () => {
      const result = await createQuiz(data)
      if (result.error) { setError(result.error); return }
      const quizId = result.data?.id

      if (quizId) {
        // Upload questions from file
        if ((questionSource === 'upload' || questionSource === 'both') && parsedQuestions.length > 0) {
          const questionInputs = parsedQuestions.map(q => ({
            quiz_id: quizId,
            question_text: q.question_text,
            options: [
              { text: q.option_a, isCorrect: q.correct_answer?.toLowerCase() === 'a' },
              { text: q.option_b, isCorrect: q.correct_answer?.toLowerCase() === 'b' },
              { text: q.option_c, isCorrect: q.correct_answer?.toLowerCase() === 'c' },
              { text: q.option_d, isCorrect: q.correct_answer?.toLowerCase() === 'd' },
            ],
            difficulty: (q.difficulty || difficulty) as DifficultyLevel,
            explanation: q.explanation || undefined,
            status: 'approved' as const,
          }))
          await bulkCreateQuestions(questionInputs)
        }

        // AI generation
        if (questionSource === 'ai' || questionSource === 'both') {
          setIsGenerating(true)
          try {
            await fetch('/api/generate-questions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quiz_id: quizId, topic, difficulty, count: questionCount }),
            })
          } catch {}
          setIsGenerating(false)
        }
      }
      router.push('/manager/quizzes')
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
        <Button variant="ghost" size="icon" asChild className="rounded-xl">
          <Link href="/manager/quizzes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
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
                  <Input name="title" placeholder="e.g., JavaScript Fundamentals Q1 2026" required className="h-11 rounded-xl" />
                  <p className="text-xs text-muted-foreground">This will be visible to employees</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Textarea name="description" placeholder="Give employees a brief overview of what this quiz covers..." rows={3} className="rounded-xl resize-none" />
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'shuffle_q', icon: Shuffle, label: 'Shuffle Questions', desc: 'Random order for each employee', value: shuffleQuestions, set: setShuffleQuestions },
                      { id: 'shuffle_o', icon: Shuffle, label: 'Shuffle Options', desc: 'Randomize answer choices', value: shuffleOptions, set: setShuffleOptions },
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
                  <Input name="feedback_form_url" type="url" placeholder="https://forms.google.com/..." className="h-11 rounded-xl" />
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
                    { id: 'upload', icon: Upload, label: 'Upload File', desc: 'CSV or Excel sheet', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', activeBg: 'bg-blue-500' },
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

                {/* AI info */}
                {(questionSource === 'ai' || questionSource === 'both') && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-50 border border-violet-100">
                    <Sparkles className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-violet-800">AI will generate {questionCount} questions on "{topic || 'your topic'}"</p>
                      <p className="text-xs text-violet-600 mt-0.5">Based on your difficulty settings: {Object.entries(distribution).filter(([,v]) => v > 0).map(([k,v]) => `${v} ${k}`).join(', ')}</p>
                    </div>
                  </div>
                )}

                {/* Upload zone */}
                {(questionSource === 'upload' || questionSource === 'both') && (
                  <div className="space-y-3">
                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />

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
                          <p className="text-sm text-emerald-600">{parsedQuestions.length} questions ready to import</p>
                          <button type="button" onClick={e => { e.stopPropagation(); setUploadedFile(null); setParsedQuestions([]) }} className="text-xs text-muted-foreground hover:text-destructive underline">Remove</button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-10 w-10 text-muted-foreground/50 mx-auto" />
                          <p className="font-medium text-sm">Drop your CSV/Excel file here or click to browse</p>
                          <p className="text-xs text-muted-foreground">Required columns: question_text, option_a, option_b, option_c, option_d, correct_answer</p>
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
                disabled={isPending || isGenerating || !topic}
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
