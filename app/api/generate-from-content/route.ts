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
    - Example: "What is...?", "Which of the following is...?", "Define..."`,
  
  medium: `
    - Questions should test understanding and application
    - Require applying knowledge to simple scenarios
    - Include some analysis of concepts
    - Incorrect options should be plausible but clearly wrong upon reflection
    - Example: "Why does...?", "How would you...?", "What happens when...?"`,
  
  hard: `
    - Questions should test analysis and problem-solving
    - Require combining multiple concepts
    - Include scenario-based questions
    - Incorrect options should be plausible and require careful analysis to eliminate
    - Example: "Analyze...", "Compare and contrast...", "What would be the result of...?"`,
  
  advanced: `
    - Questions should test evaluation and synthesis
    - Require deep understanding and critical thinking
    - Include complex scenarios with multiple variables
    - All options should seem plausible, requiring expert knowledge to identify correct answer
    - Example: "Evaluate...", "What is the optimal approach for...", "In this complex scenario..."`,
  
  hardcore: `
    - Questions should test expert-level mastery
    - Require integration of advanced concepts across multiple domains
    - Include edge cases, exceptions, and nuanced scenarios
    - All options should be highly plausible, only distinguishable by true experts
    - Example: "In an edge case where...", "Considering all factors...", "What is the most efficient..."`
}

/**
 * Generate questions from provided content with strict difficulty enforcement
 */
export async function POST(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  const supabase = await createClient()

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

  // Calculate distribution: 70% primary difficulty, 30% spread across others
  const distribution = calculateStrictDistribution(difficulty, count)

  const openaiKey = process.env.OPENAI_API_KEY
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY

  let questions: any[] = []

  if (openaiKey) {
    questions = await generateFromContentOpenAI(openaiKey, content, distribution, topic)
  } else if (geminiKey) {
    questions = await generateFromContentGemini(geminiKey, content, distribution, topic)
  } else {
    return NextResponse.json({ 
      error: 'No AI API key configured. Please set OPENAI_API_KEY or GOOGLE_GEMINI_API_KEY in environment variables.' 
    }, { status: 500 })
  }

  questions = ensureContentQuestionCount(questions, topic || 'Provided content', content, difficulty, count)

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
    is_ai_generated: true,
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

async function generateFromContentOpenAI(
  apiKey: string, 
  content: string, 
  distribution: Record<DifficultyLevel, number>,
  topic?: string
) {
  const questions: any[] = []
  
  // Truncate content if too long (keep most relevant parts)
  const maxContentLength = 12000
  const truncatedContent = content.length > maxContentLength 
    ? content.substring(0, maxContentLength) + '...[content truncated]'
    : content

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
            
CRITICAL: The difficulty level MUST be strictly followed. Do not make questions easier or harder than specified.

You will be given content to base questions on. Extract key concepts and create challenging, relevant multiple-choice questions.`
          }, {
            role: 'user',
            content: `Generate EXACTLY ${count} multiple choice questions at "${diff.toUpperCase()}" difficulty level.

${topic ? `Topic/Subject: ${topic}` : ''}

DIFFICULTY REQUIREMENTS FOR ${diff.toUpperCase()}:
${difficultyGuidelines}

CONTENT TO BASE QUESTIONS ON:
---
${truncatedContent}
---

REQUIREMENTS:
1. Questions MUST be directly based on the provided content
2. Questions MUST match the ${diff.toUpperCase()} difficulty level exactly
3. Each question must have exactly 4 options with only ONE correct answer
4. Include a brief explanation for the correct answer
5. Make incorrect options plausible but clearly wrong for someone who knows the material
6. Do not use outside knowledge unless the content itself clearly supports it
7. Avoid duplicate questions and spread questions across different parts of the content
8. Avoid vague wording like "according to the passage"; ask concrete, job-ready questions

Return a JSON array where each item has:
- "question_text": the question (challenging and specific to content)
- "options": array of exactly 4 objects with "text" (string) and "isCorrect" (boolean, exactly one true). Randomize the correct answer position across A, B, C, and D.
- "explanation": brief explanation of why the correct answer is right
- "difficulty": "${diff}"

Return ONLY valid JSON, no markdown code blocks.`
          }],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      })

      const data = await response.json()
      
      if (data.error) {
        console.error('OpenAI API error:', data.error)
        continue
      }

      const content = data.choices?.[0]?.message?.content || '[]'
      
      // Clean up response and parse JSON
      let cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      
      try {
        const parsed = JSON.parse(cleanedContent)
        const validQuestions = normalizeQuestions(Array.isArray(parsed) ? parsed : [parsed], diff as DifficultyLevel)
        
        questions.push(...validQuestions)
        if (validQuestions.length < count) {
          questions.push(...buildContentFallbackQuestions(topic || 'Provided content', truncatedContent, diff as DifficultyLevel, count - validQuestions.length))
        }
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', parseError)
        questions.push(...buildContentFallbackQuestions(topic || 'Provided content', truncatedContent, diff as DifficultyLevel, count))
      }
    } catch (e) {
      console.error('OpenAI generation error:', e)
      questions.push(...buildContentFallbackQuestions(topic || 'Provided content', truncatedContent, diff as DifficultyLevel, count))
    }
  }

  return questions
}

async function generateFromContentGemini(
  apiKey: string, 
  content: string, 
  distribution: Record<DifficultyLevel, number>,
  topic?: string
) {
  const questions: any[] = []
  
  const maxContentLength = 10000
  const truncatedContent = content.length > maxContentLength 
    ? content.substring(0, maxContentLength) + '...[content truncated]'
    : content

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
                text: `You are an expert quiz question generator. Generate EXACTLY ${count} multiple choice questions at "${diff.toUpperCase()}" difficulty level.

${topic ? `Topic/Subject: ${topic}` : ''}

DIFFICULTY REQUIREMENTS FOR ${diff.toUpperCase()}:
${difficultyGuidelines}

CRITICAL: Questions MUST match the ${diff.toUpperCase()} difficulty level exactly. Do not make them easier or harder.

CONTENT TO BASE QUESTIONS ON:
---
${truncatedContent}
---

REQUIREMENTS:
1. Questions MUST be directly based on the provided content
2. Each question must have exactly 4 options with only ONE correct answer
3. Include a brief explanation for the correct answer
4. Do not use outside knowledge unless the content itself clearly supports it
5. Avoid duplicate questions and spread questions across different parts of the content
6. Avoid vague wording like "according to the passage"; ask concrete, job-ready questions

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
              maxOutputTokens: 4000,
            }
          }),
        }
      )

      const data = await response.json()
      const responseContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
      
      let cleanedContent = responseContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      try {
        const parsed = JSON.parse(cleanedContent)
        const validQuestions = normalizeQuestions(Array.isArray(parsed) ? parsed : [parsed], diff as DifficultyLevel)
        
        questions.push(...validQuestions)
        if (validQuestions.length < count) {
          questions.push(...buildContentFallbackQuestions(topic || 'Provided content', truncatedContent, diff as DifficultyLevel, count - validQuestions.length))
        }
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', parseError)
        questions.push(...buildContentFallbackQuestions(topic || 'Provided content', truncatedContent, diff as DifficultyLevel, count))
      }
    } catch (e) {
      console.error('Gemini generation error:', e)
      questions.push(...buildContentFallbackQuestions(topic || 'Provided content', truncatedContent, diff as DifficultyLevel, count))
    }
  }

  return questions
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
      difficulty,
    }))
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
