import { createClient } from '@/lib/supabase/server'
import { requireManagerForApi } from '@/lib/rbac'
import { NextRequest, NextResponse } from 'next/server'
import type { DifficultyLevel } from '@/lib/types/database'

const ALL_DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard', 'advanced', 'hardcore']

type QuestionOption = { text: string; isCorrect: boolean }

// Difficulty-specific prompts to ensure proper question complexity
const DIFFICULTY_PROMPTS: Record<DifficultyLevel, string> = {
  easy: `
    - Questions should test basic recall and fundamental understanding
    - Use simple, straightforward language
    - Focus on definitions, basic facts, and simple concepts
    - Incorrect options should be clearly distinguishable from correct ones
    - Example types: "What is...?", "Which of the following is...?", "Define..."`,
  
  medium: `
    - Questions should test understanding and application
    - Require applying knowledge to simple scenarios
    - Include some analysis of concepts
    - Incorrect options should be plausible but clearly wrong upon reflection
    - Example types: "Why does...?", "How would you...?", "What happens when...?"`,
  
  hard: `
    - Questions should test analysis and problem-solving
    - Require combining multiple concepts
    - Include scenario-based questions
    - Incorrect options should be plausible and require careful analysis
    - Example types: "Analyze...", "Compare and contrast...", "What would be the result of...?"`,
  
  advanced: `
    - Questions should test evaluation and synthesis
    - Require deep understanding and critical thinking
    - Include complex scenarios with multiple variables
    - All options should seem plausible, requiring expert knowledge
    - Example types: "Evaluate...", "What is the optimal approach...", "In this complex scenario..."`,
  
  hardcore: `
    - Questions should test expert-level mastery
    - Require integration of advanced concepts across multiple domains
    - Include edge cases, exceptions, and nuanced scenarios
    - All options should be highly plausible, only distinguishable by true experts
    - Example types: "In an edge case where...", "Considering all factors...", "What is the most efficient..."`
}

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

  // Generate questions using the hybrid approach
  // First try the AI provider if API key is available, then fall back to template-based
  let questions: any[] = []

  const openaiKey = process.env.OPENAI_API_KEY
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY

  console.log('AI API Keys available:', {
    openai: !!openaiKey,
    gemini: !!geminiKey
  })

  if (openaiKey) {
    console.log('Using OpenAI for question generation')
    questions = await generateWithOpenAI(openaiKey, topic, distribution)
  } else if (geminiKey) {
    console.log('Using Gemini for question generation')  
    questions = await generateWithGemini(geminiKey, topic, distribution)
  } else {
    console.log('No AI keys available, falling back to template generation')
    // Fallback: template-based generation
    questions = generateTemplateQuestions(topic, distribution)
  }

  questions = ensureQuestionCount(questions, topic, difficulty, count)

  console.log(`Generated ${questions.length} questions using ${openaiKey || geminiKey ? 'AI' : 'templates'}`)

  if (questions.length === 0) {
    return NextResponse.json({ error: 'Failed to generate any questions' }, { status: 500 })
  }

  // Insert questions into database
  const answerPositionPlan = createAnswerPositionPlan(questions.length)
  const questionsToInsert = questions.map((q, i) => ({
    quiz_id,
    question_text: q.question_text,
    options: randomizeOptions(q.options, answerPositionPlan[i]),
    difficulty: q.difficulty,
    explanation: q.explanation || null,
    is_ai_generated: !!(openaiKey || geminiKey),
    order_index: i,
  }))

  const { data, error } = await supabase
    .from('questions')
    .insert(questionsToInsert)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const generationMethod = openaiKey ? 'OpenAI' : geminiKey ? 'Gemini' : 'Template-based'
  
  return NextResponse.json({ 
    data, 
    distribution,
    generated: questions.length,
    method: generationMethod,
    success: `Successfully generated ${questions.length} questions using ${generationMethod}`
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

// ─── OpenAI generation ────────────────────────────────────────────────
async function generateWithOpenAI(apiKey: string, topic: string, distribution: Record<DifficultyLevel, number>) {
  const questions: any[] = []

  for (const [diff, count] of Object.entries(distribution)) {
    if (count === 0) continue

    const difficultyGuidelines = DIFFICULTY_PROMPTS[diff as DifficultyLevel]

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
            content: `You are an expert quiz question generator. You MUST create questions at EXACTLY the specified difficulty level.

CRITICAL: The difficulty level MUST be strictly followed. Do not make questions easier or harder than specified.`
          }, {
            role: 'user',
            content: `Generate EXACTLY ${count} multiple choice questions about "${topic}" at "${diff.toUpperCase()}" difficulty level.

DIFFICULTY REQUIREMENTS FOR ${diff.toUpperCase()}:
${difficultyGuidelines}

REQUIREMENTS:
1. Questions MUST match the ${diff.toUpperCase()} difficulty level exactly
2. Each question must have exactly 4 options with only ONE correct answer
3. Include a brief explanation for the correct answer
4. Make incorrect options plausible but clearly wrong for someone who knows the material

Return a JSON array where each item has:
- "question_text": the question
- "options": array of exactly 4 objects with "text" (string) and "isCorrect" (boolean, exactly one true). Randomize the correct answer position across A, B, C, and D.
- "explanation": brief explanation of the correct answer
- "difficulty": "${diff}"

Return ONLY valid JSON, no markdown code blocks.`
          }],
          temperature: 0.7,
        }),
      })

      const data = await response.json()
      
      if (data.error) {
        console.error(`OpenAI API error for ${diff} difficulty:`, data.error)
        // Fall back to template for this batch
        questions.push(...generateTemplateQuestions(topic, { [diff]: count } as any))
        continue
      }
      
      const content = data.choices?.[0]?.message?.content || '[]'
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      try {
        const parsed = JSON.parse(cleanedContent)
        const validQuestions = normalizeQuestions(Array.isArray(parsed) ? parsed : [parsed], diff as DifficultyLevel)
        
        if (validQuestions.length === 0) {
          console.warn(`No valid questions parsed from OpenAI response for ${diff} difficulty`)
          questions.push(...generateTemplateQuestions(topic, { [diff]: count } as any))
        } else {
          console.log(`Generated ${validQuestions.length} ${diff} questions via OpenAI`)
          questions.push(...validQuestions)
          if (validQuestions.length < count) {
            questions.push(...generateTemplateQuestions(topic, { [diff]: count - validQuestions.length } as any))
          }
        }
      } catch (parseError) {
        console.error(`Failed to parse OpenAI response for ${diff} difficulty:`, parseError)
        // Fall back to template for this batch
        questions.push(...generateTemplateQuestions(topic, { [diff]: count } as any))
      }
    } catch (e) {
      console.error(`OpenAI request failed for ${diff} difficulty:`, e)
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

    const difficultyGuidelines = DIFFICULTY_PROMPTS[diff as DifficultyLevel]

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Generate EXACTLY ${count} multiple choice questions about "${topic}" at "${diff.toUpperCase()}" difficulty level.

DIFFICULTY REQUIREMENTS FOR ${diff.toUpperCase()}:
${difficultyGuidelines}

CRITICAL: Questions MUST match the ${diff.toUpperCase()} difficulty level exactly. Do not make them easier or harder.

REQUIREMENTS:
1. Each question must have exactly 4 options with only ONE correct answer
2. Include a brief explanation for the correct answer

Return a JSON array where each item has:
- "question_text": the question
- "options": array of exactly 4 objects with "text" (string) and "isCorrect" (boolean, exactly one true). Randomize the correct answer position across A, B, C, and D.
- "explanation": brief explanation
- "difficulty": "${diff}"

Return ONLY valid JSON, no markdown.`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
            }
          }),
        }
      )

      const data = await response.json()
      
      if (data.error) {
        console.error(`Gemini API error for ${diff} difficulty:`, data.error)
        // Fall back to template for this batch
        questions.push(...generateTemplateQuestions(topic, { [diff]: count } as any))
        continue
      }
      
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      try {
        const parsed = JSON.parse(cleanedContent)
        const validQuestions = normalizeQuestions(Array.isArray(parsed) ? parsed : [parsed], diff as DifficultyLevel)
        
        if (validQuestions.length === 0) {
          console.warn(`No valid questions parsed from Gemini response for ${diff} difficulty`)
          questions.push(...generateTemplateQuestions(topic, { [diff]: count } as any))
        } else {
          console.log(`Generated ${validQuestions.length} ${diff} questions via Gemini`)
          questions.push(...validQuestions)
          if (validQuestions.length < count) {
            questions.push(...generateTemplateQuestions(topic, { [diff]: count - validQuestions.length } as any))
          }
        }
      } catch (parseError) {
        console.error(`Failed to parse Gemini response for ${diff} difficulty:`, parseError)
        questions.push(...generateTemplateQuestions(topic, { [diff]: count } as any))
      }
    } catch (e) {
      console.error(`Gemini request failed for ${diff} difficulty:`, e)
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
      difficulty,
    }))
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
