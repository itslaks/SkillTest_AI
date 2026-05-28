/**
 * POST /api/ai-recommend
 * Returns a personalised AI learning recommendation for an employee.
 * Capped at 150 tokens — very cheap, called once per employee dashboard load.
 */
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { stats, quizzes, retentionRisk } = await request.json()

    const points = stats?.stats?.total_points ?? 0
    const streak = stats?.stats?.current_streak ?? 0
    const completed = stats?.stats?.tests_completed ?? 0
    const open = quizzes?.filter((q: any) => q.attemptStatus !== 'completed').length ?? 0
    const nextQuiz = quizzes?.find((q: any) => q.attemptStatus !== 'completed')
    const passRate = stats?.stats?.pass_rate ?? 0

    const context = `learner: points=${points}, streak=${streak}d, completed=${completed}, open=${open}, passRate=${passRate}%${retentionRisk ? `, retention risk: ${retentionRisk.topic} (${retentionRisk.daysSinceLastAssessment} days)` : ''}${nextQuiz ? `, next quiz: "${nextQuiz.title}" (${nextQuiz.topic})` : ''}`

    const { text } = await callAI(
      [
        {
          role: 'system',
          content: 'You are a learning coach inside SkillTest_AI: Mavericks Execution Platform. Give one short, encouraging, personalised recommendation (max 2 sentences). Be direct and practical, not generic.',
        },
        { role: 'user', content: context },
      ],
      { maxTokens: 150, temperature: 0.7 }
    )

    return NextResponse.json({ recommendation: text.trim() })
  } catch (error: any) {
    console.error('AI recommend error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
