import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { DifficultyLevel } from '@/lib/types/database'

const ALL_DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'advanced', 'hardcore']

/**
 * Dynamically generates MCQs based on the difficulty distribution:
 * - 50% from the selected difficulty
 * - 10% each from the remaining four difficulties
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Verify manager role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

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

  // Generate questions using the hybrid approach
  // First try the AI provider if API key is available, then fall back to template-based
  let questions: any[] = []

  const openaiKey = process.env.OPENAI_API_KEY
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY

  if (openaiKey) {
    questions = await generateWithOpenAI(openaiKey, topic, distribution)
  } else if (geminiKey) {
    questions = await generateWithGemini(geminiKey, topic, distribution)
  } else {
    // Fallback: template-based generation
    questions = generateTemplateQuestions(topic, distribution)
  }

  // Insert questions into database
  const questionsToInsert = questions.map((q, i) => ({
    quiz_id,
    question_text: q.question_text,
    options: q.options,
    difficulty: q.difficulty,
    explanation: q.explanation || null,
    is_ai_generated: !!(openaiKey || geminiKey),
    is_approved: !(openaiKey || geminiKey), // AI questions need approval
    order_index: i,
  }))

  const { data, error } = await supabase
    .from('questions')
    .insert(questionsToInsert)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data, distribution })
}

function calculateDistribution(primary: DifficultyLevel, totalCount: number): Record<DifficultyLevel, number> {
  const primaryCount = Math.ceil(totalCount * 0.5)
  const remaining = totalCount - primaryCount
  const otherDifficulties = ALL_DIFFICULTIES.filter(d => d !== primary)
  const perOther = Math.floor(remaining / otherDifficulties.length)
  let leftover = remaining - (perOther * otherDifficulties.length)

  const dist: Record<string, number> = { [primary]: primaryCount }
  for (const d of otherDifficulties) {
    dist[d] = perOther + (leftover > 0 ? 1 : 0)
    if (leftover > 0) leftover--
  }

  return dist as Record<DifficultyLevel, number>
}

// ─── OpenAI generation ────────────────────────────────────────────────
async function generateWithOpenAI(apiKey: string, topic: string, distribution: Record<DifficultyLevel, number>) {
  const questions: any[] = []

  for (const [diff, count] of Object.entries(distribution)) {
    if (count === 0) continue

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'system',
            content: 'You are a quiz question generator. Generate multiple choice questions in JSON format.'
          }, {
            role: 'user',
            content: `Generate ${count} multiple choice questions about "${topic}" at "${diff}" difficulty level.
            
Return a JSON array where each item has:
- "question_text": the question
- "options": array of 4 objects with "text" (string) and "isCorrect" (boolean, exactly one true)
- "explanation": brief explanation of the correct answer
- "difficulty": "${diff}"

Return ONLY valid JSON, no markdown.`
          }],
          temperature: 0.8,
        }),
      })

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || '[]'
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''))
      questions.push(...(Array.isArray(parsed) ? parsed : [parsed]))
    } catch (e) {
      // Fall back to template for this batch
      questions.push(...generateTemplateQuestions(topic, { [diff]: count } as any))
    }
  }

  return questions
}

// ─── Gemini generation ────────────────────────────────────────────────
async function generateWithGemini(apiKey: string, topic: string, distribution: Record<DifficultyLevel, number>) {
  const questions: any[] = []

  for (const [diff, count] of Object.entries(distribution)) {
    if (count === 0) continue

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Generate ${count} multiple choice questions about "${topic}" at "${diff}" difficulty level.

Return a JSON array where each item has:
- "question_text": the question
- "options": array of 4 objects with "text" (string) and "isCorrect" (boolean, exactly one true)
- "explanation": brief explanation of the correct answer
- "difficulty": "${diff}"

Return ONLY valid JSON, no markdown.`
              }]
            }],
          }),
        }
      )

      const data = await response.json()
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''))
      questions.push(...(Array.isArray(parsed) ? parsed : [parsed]))
    } catch (e) {
      questions.push(...generateTemplateQuestions(topic, { [diff]: count } as any))
    }
  }

  return questions
}

// ─── Template-based fallback generation ───────────────────────────────
function generateTemplateQuestions(topic: string, distribution: Record<string, number>) {
  const questions: any[] = []
  const templates = getTemplatesForTopic(topic)

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

function getTemplatesForTopic(topic: string) {
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
