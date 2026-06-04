import { createClient } from '@/lib/supabase/server'
import { requireManagerForApi } from '@/lib/rbac'
import { NextRequest, NextResponse } from 'next/server'
import type { DifficultyLevel } from '@/lib/types/database'
import { callAI, stripCodeFences } from '@/lib/ai'

const ALL_DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'advanced', 'hardcore']
const DIFFICULTY_SET = new Set<DifficultyLevel>(ALL_DIFFICULTIES)

type QuestionOption = { text: string; isCorrect: boolean }

/**
 * Dynamically generates MCQs based on the difficulty distribution:
 * - 50% from the selected difficulty
 * - 10% each from the remaining four difficulties
 */
export async function POST(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()

  const body = await request.json()
  const { quiz_id, topic, difficulty, count } = body as {
    quiz_id: string
    topic: string
    difficulty: DifficultyLevel
    count: number
  }

  if (!quiz_id || !topic || !difficulty || !count) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Calculate distribution
  const distribution = calculateDistribution(difficulty, count)

  const hasAI = !!(process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || process.env.GOOGLE_GEMINI_API_KEY)

  // Single AI call for all difficulty groups, or template fallback
  const questions = hasAI
    ? await generateWithAI(topic, distribution)
    : generateTemplateQuestions(topic, distribution)

  const finalQuestions = ensureQuestionCount(questions, topic, difficulty, count)

  console.log(`Generated ${finalQuestions.length} questions using ${hasAI ? 'AI' : 'templates'}`)

  if (finalQuestions.length === 0) {
    return NextResponse.json({ error: 'Failed to generate any questions' }, { status: 500 })
  }

  // Insert questions into database
  const answerPositionPlan = createAnswerPositionPlan(finalQuestions.length)
  const questionsToInsert = finalQuestions.map((q: any, i: number) => ({
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

  const generationMethod = process.env.OPENAI_API_KEY
    ? 'OpenAI'
    : process.env.GROQ_API_KEY
      ? 'Groq'
      : process.env.GOOGLE_GEMINI_API_KEY
        ? 'Gemini'
        : 'Template-based'
  
  return NextResponse.json({ 
    data, 
    distribution,
    generated: finalQuestions.length,
    method: generationMethod,
    success: `Successfully generated ${finalQuestions.length} questions using ${generationMethod}`
  })
}

function calculateDistribution(primary: DifficultyLevel, totalCount: number): Record<DifficultyLevel, number> {
  // 70% primary difficulty for stricter adherence to selected difficulty
  const primaryCount = Math.ceil(totalCount * 0.7)
  const remaining = totalCount - primaryCount
  
  // Get adjacent difficulties for more natural distribution
  const primaryIndex = ALL_DIFFICULTIES.indexOf(primary)
  const adjacentDifficulties = ALL_DIFFICULTIES.filter((d, i) => {
    if (d === primary) return false
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

// ─── Single-call AI generation (OpenAI preferred, Gemini fallback) ───
async function generateWithAI(topic: string, distribution: Record<DifficultyLevel, number>) {
  // Build all difficulty groups into ONE prompt → one API call, minimal token cost
  const groups = Object.entries(distribution)
    .filter(([, count]) => count > 0)
    .map(([diff, count]) => `${count} questions at "${diff.toUpperCase()}" difficulty`)

  const prompt = `Generate MCQ questions about "${topic}" in a SINGLE JSON array.
Required groups: ${groups.join('; ')}.
Each question: {"question_text":string,"options":[{"text":string,"isCorrect":bool}x4],"explanation":string,"difficulty":string}
Rules: exactly 4 options, exactly 1 correct per question, match stated difficulty, return ONLY valid JSON array.`

  try {
    const { text } = await callAI(
      [
        { role: 'system', content: 'You are an expert quiz question generator. Output only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { maxTokens: 4000, temperature: 0.6 }
    )

    const parsed = JSON.parse(stripCodeFences(text))
    const questions = normalizeQuestions(Array.isArray(parsed) ? parsed : [parsed], 'medium')
    if (questions.length > 0) return questions
  } catch (e) {
    console.error('AI generation failed, falling back to templates:', e)
  }

  return generateTemplateQuestions(topic, distribution)
}

// ─── Template-based fallback generation ───────────────────────────────
function generateTemplateQuestions(topic: string, distribution: Record<string, number>) {
  const questions: any[] = []
  const templates = getTemplatesForTopic()

  for (const [diff, count] of Object.entries(distribution)) {
    for (let i = 0; i < count; i++) {
      const template = templates[Math.floor(Math.random() * templates.length)]
      questions.push({
        question_text: template.question.replace('{topic}', topic).replace('{difficulty}', diff),
        options: template.options.map((opt: any) => ({
          text: opt.text.replace('{topic}', topic),
          isCorrect: opt.isCorrect,
        })),
        explanation: template.explanation?.replace('{topic}', topic) || `This is a ${diff} level question about ${topic}.`,
        difficulty: diff,
      })
    }
  }

  return questions
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

function ensureQuestionCount(
  questions: any[],
  topic: string,
  primaryDifficulty: DifficultyLevel,
  requestedCount: number,
) {
  const deduped = questions.filter((question, index, collection) => {
    const text = String(question?.question_text || '').trim().toLowerCase()
    return text && collection.findIndex((item) => String(item?.question_text || '').trim().toLowerCase() === text) === index
  })

  if (deduped.length < requestedCount) {
    deduped.push(
      ...generateTemplateQuestions(topic, {
        [primaryDifficulty]: requestedCount - deduped.length,
      } as Record<string, number>)
    )
  }

  return deduped.slice(0, requestedCount)
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

function getTemplatesForTopic() {
  return [
    {
      question: `Which of the following best describes a key concept in {topic}?`,
      options: [
        { text: `The fundamental principle of {topic}`, isCorrect: true },
        { text: `An unrelated concept to {topic}`, isCorrect: false },
        { text: `A deprecated approach in {topic}`, isCorrect: false },
        { text: `A common misconception about {topic}`, isCorrect: false },
      ],
      explanation: `Understanding the fundamental principle is key to mastering {topic}.`,
    },
    {
      question: `What is the primary benefit of understanding {topic}?`,
      options: [
        { text: `Improved problem-solving capability`, isCorrect: true },
        { text: `No practical benefit`, isCorrect: false },
        { text: `Only useful in theoretical contexts`, isCorrect: false },
        { text: `Reduces the need for other skills`, isCorrect: false },
      ],
      explanation: `{topic} knowledge improves overall problem-solving capability.`,
    },
    {
      question: `In the context of {topic}, what approach is considered best practice?`,
      options: [
        { text: `Following established standards and guidelines`, isCorrect: true },
        { text: `Ignoring documentation`, isCorrect: false },
        { text: `Relying solely on trial and error`, isCorrect: false },
        { text: `Avoiding peer review`, isCorrect: false },
      ],
      explanation: `Best practice in {topic} involves following established standards.`,
    },
    {
      question: `Which challenge is most commonly associated with {topic}?`,
      options: [
        { text: `Keeping up with evolving standards`, isCorrect: true },
        { text: `Lack of available resources`, isCorrect: false },
        { text: `No challenges exist`, isCorrect: false },
        { text: `It has been fully solved`, isCorrect: false },
      ],
      explanation: `{topic} constantly evolves, requiring continuous learning.`,
    },
    {
      question: `How does {topic} relate to modern industry practices?`,
      options: [
        { text: `It is integral to current industry workflows`, isCorrect: true },
        { text: `It has no relevance today`, isCorrect: false },
        { text: `It was only relevant a decade ago`, isCorrect: false },
        { text: `Only startups use it`, isCorrect: false },
      ],
      explanation: `{topic} plays an integral role in modern industry practices.`,
    },
  ]
}
