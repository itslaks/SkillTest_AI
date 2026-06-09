import { createAdminClient } from '@/lib/supabase/server'
import { requireTrainingStaffForApi } from '@/lib/rbac'
import { NextRequest, NextResponse } from 'next/server'
import type { DifficultyLevel } from '@/lib/types/database'
import { callAI, stripCodeFences } from '@/lib/ai'

const ALL_DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'advanced', 'hardcore']
const DIFFICULTY_SET = new Set<DifficultyLevel>(ALL_DIFFICULTIES)

type QuestionOption = { text: string; isCorrect: boolean }

/**
 * Generate questions from provided content with strict difficulty enforcement
 */
export async function POST(request: NextRequest) {
  const auth = await requireTrainingStaffForApi()
  if (auth instanceof NextResponse) return auth

  const supabase = createAdminClient()

  const body = await request.json()
  const { quiz_id, content, difficulty, count, topic } = body as {
    quiz_id: string
    content: string
    difficulty: DifficultyLevel
    count: number
    topic?: string
  }

  if (!quiz_id || !content || !difficulty || !count) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: quiz, error: quizError } = await supabase
    .from('quizzes')
    .select('id, created_by')
    .eq('id', quiz_id)
    .maybeSingle()
  if (quizError) return NextResponse.json({ error: quizError.message }, { status: 500 })
  if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
  if (auth.role !== 'admin' && quiz.created_by !== auth.userId) {
    return NextResponse.json({ error: 'Not authorized for this quiz' }, { status: 403 })
  }

  const distribution = calculateStrictDistribution(difficulty, count)
  const hasAI = !!(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.GOOGLE_GEMINI_API_KEY)

  const rawQuestions = hasAI ? await generateFromContentAI(content, distribution, topic) : []
  const questions = applyDifficultyPlan(
    ensureContentQuestionCount(rawQuestions, topic || 'Provided content', content, difficulty, count),
    distribution,
    difficulty
  )

  if (questions.length === 0) {
    return NextResponse.json({ 
      error: 'Failed to generate questions from the provided content. Please try with different content or check AI API configuration.' 
    }, { status: 500 })
  }

  // Insert questions into database
  const answerPositionPlan = createAnswerPositionPlan(questions.length)
  const questionsToInsert = questions.map((q, i) => ({
    quiz_id,
    question_text: q.question_text,
    options: randomizeOptions(q.options, answerPositionPlan[i]),
    difficulty: q.difficulty,
    explanation: q.explanation || null,
    is_ai_generated: hasAI,
    order_index: i,
  }))

  const { data, error } = await supabase
    .from('questions')
    .insert(questionsToInsert)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ 
    data, 
    distribution,
    generated: questions.length,
    method: process.env.OPENAI_API_KEY
      ? 'OpenAI'
      : process.env.GROQ_API_KEY
        ? 'Groq'
        : process.env.GOOGLE_GEMINI_API_KEY
          ? 'Gemini'
          : 'SkillTest_AI local content intelligence',
  })
}

function calculateStrictDistribution(primary: DifficultyLevel, totalCount: number): Record<DifficultyLevel, number> {
  // 70% primary difficulty for stricter adherence
  const primaryCount = Math.ceil(totalCount * 0.7)
  const remaining = totalCount - primaryCount
  
  // Get adjacent difficulties for more natural distribution
  const primaryIndex = ALL_DIFFICULTIES.indexOf(primary)
  const adjacentDifficulties = ALL_DIFFICULTIES.filter((d, i) => {
    if (d === primary) return false
    // Prefer adjacent difficulties
    return Math.abs(i - primaryIndex) <= 2
  })
  
  const perOther = Math.floor(remaining / adjacentDifficulties.length)
  let leftover = remaining - (perOther * adjacentDifficulties.length)

  const dist: Record<string, number> = { [primary]: primaryCount }
  
  for (const d of adjacentDifficulties) {
    dist[d] = perOther + (leftover > 0 ? 1 : 0)
    if (leftover > 0) leftover--
  }
  
  // Fill in zeros for non-adjacent
  for (const d of ALL_DIFFICULTIES) {
    if (!(d in dist)) dist[d] = 0
  }

  return dist as Record<DifficultyLevel, number>
}

// ─── Single-call AI generation from content ───────────────────────────
async function generateFromContentAI(
  content: string,
  distribution: Record<DifficultyLevel, number>,
  topic?: string
) {
  // Truncate content to keep tokens lean (~3000 chars ≈ 750 tokens of context)
  const truncated = content.length > 3000 ? content.substring(0, 3000) + '...[truncated]' : content

  const groups = Object.entries(distribution)
    .filter(([, count]) => count > 0)
    .map(([diff, count]) => `${count} at "${diff.toUpperCase()}"`)

  const prompt = `Generate MCQ questions STRICTLY based on the content below.${topic ? ` Topic: ${topic}.` : ''}
Required: ${groups.join(', ')}.
Each question: {"question_text":string,"options":[{"text":string,"isCorrect":bool}x4],"explanation":string,"difficulty":string}
Rules: 4 options, 1 correct, match stated difficulty, base every question on the content, return ONLY a valid JSON array.

CONTENT:
${truncated}`

  try {
    const { text } = await callAI(
      [
        { role: 'system', content: 'You are an expert quiz question generator. Output only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { maxTokens: 4000, temperature: 0.6 }
    )
    const parsed = JSON.parse(stripCodeFences(text))
    return normalizeQuestions(Array.isArray(parsed) ? parsed : [parsed], 'medium' as DifficultyLevel)
  } catch (e) {
    console.error('AI content generation failed:', e)
    return []
  }
}

function createAnswerPositionPlan(count: number) {
  const positions = Array.from({ length: count }, (_, index) => index % 4)
  return shuffleOptions(positions)
}

function randomizeOptions(options: QuestionOption[], targetCorrectIndex: number) {
  const correct = options.find((option) => option.isCorrect)
  const incorrect = shuffleOptions(options.filter((option) => !option.isCorrect))

  if (!correct || incorrect.length !== 3) {
    return shuffleOptions(options)
  }

  const result = [...incorrect]
  result.splice(targetCorrectIndex, 0, correct)
  return result
}

function shuffleOptions<T>(options: T[]) {
  const shuffled = [...options]

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}

function normalizeQuestions(rawQuestions: any[], difficulty: DifficultyLevel) {
  return rawQuestions
    .filter((q: any) =>
      q?.question_text &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      q.options.filter((option: any) => option?.isCorrect).length === 1
    )
    .map((q: any) => ({
      question_text: q.question_text,
      options: q.options,
      explanation: q.explanation || null,
      difficulty: normalizeDifficulty(q.difficulty, difficulty),
    }))
}

function normalizeDifficulty(value: unknown, fallback: DifficultyLevel): DifficultyLevel {
  const normalized = String(value || '').toLowerCase().trim() as DifficultyLevel
  return DIFFICULTY_SET.has(normalized) ? normalized : fallback
}

function buildContentFallbackQuestions(topic: string, content: string, difficulty: DifficultyLevel, count: number) {
  const sentences = content
    .split(/[\.\n]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 40)
    .slice(0, Math.max(count * 2, 4))

  const fallbackPool = sentences.length > 0 ? sentences : [`Key concepts related to ${topic}`]

  return Array.from({ length: count }, (_, index) => {
    const basis = fallbackPool[index % fallbackPool.length]
    return {
      question_text: `Which statement best reflects this ${difficulty} insight about ${topic}: "${basis}"?`,
      options: [
        { text: basis, isCorrect: true },
        { text: `An unrelated claim that conflicts with ${topic}`, isCorrect: false },
        { text: `A vague assumption that is not supported by the provided material`, isCorrect: false },
        { text: `A misleading shortcut that skips the main idea from the content`, isCorrect: false },
      ],
      explanation: `The correct option stays closest to the provided material for ${topic}.`,
      difficulty,
    }
  })
}

function ensureContentQuestionCount(
  questions: any[],
  topic: string,
  content: string,
  primaryDifficulty: DifficultyLevel,
  requestedCount: number,
) {
  const deduped = questions.filter((question, index, collection) => {
    const text = String(question?.question_text || '').trim().toLowerCase()
    return text && collection.findIndex((item) => String(item?.question_text || '').trim().toLowerCase() === text) === index
  })

  if (deduped.length < requestedCount) {
    deduped.push(...buildContentFallbackQuestions(topic, content, primaryDifficulty, requestedCount - deduped.length))
  }

  return deduped.slice(0, requestedCount)
}

function applyDifficultyPlan(
  questions: any[],
  distribution: Record<DifficultyLevel, number>,
  fallback: DifficultyLevel,
) {
  const plan = ALL_DIFFICULTIES.flatMap((difficulty) =>
    Array.from({ length: distribution[difficulty] || 0 }, () => difficulty)
  )

  return questions.map((question, index) => ({
    ...question,
    difficulty: normalizeDifficulty(plan[index] || question?.difficulty, fallback),
  }))
}
