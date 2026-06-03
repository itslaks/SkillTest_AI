import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingStaffForApi } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'
import { getAccessibleTrainingBatchIds } from '@/lib/training-access'
import { callAI } from '@/lib/ai'

export async function POST(request: NextRequest) {
  const auth = await requireTrainingStaffForApi()
  if (auth instanceof NextResponse) return auth

  const { message } = await request.json()
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const batchIds = await getAccessibleTrainingBatchIds(auth.userId, auth.role)

  const [
    { data: quizzes },
    { data: attempts },
    { data: profiles },
    { data: badges },
    { data: certificates },
    { data: attendance },
  ] = await Promise.all([
    admin
      .from('quizzes')
      .select('id, title, topic, difficulty, passing_score, created_by, batch_id')
      .or(`created_by.eq.${auth.userId}${batchIds.length ? `,batch_id.in.(${batchIds.join(',')})` : ''}`)
      .limit(80),
    admin
      .from('quiz_attempts')
      .select('quiz_id, user_id, score, status, correct_answers, total_questions, time_taken_seconds, points_earned, completed_at, answers, quizzes:quiz_id(title, topic, difficulty)')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(250),
    admin
      .from('profiles')
      .select('id, full_name, email, employee_id, department, domain, role')
      .limit(500),
    admin
      .from('user_badges')
      .select('user_id, badges(name, category, rarity)')
      .limit(500),
    admin
      .from('certificates')
      .select('user_id, quiz_id, title, score, issued_at')
      .limit(250),
    admin
      .from('session_attendance')
      .select('user_id, status, session:session_id(batch_id, title, session_date)')
      .limit(500),
  ])

  const context = buildChatbotContext({
    quizzes: quizzes || [],
    attempts: attempts || [],
    profiles: profiles || [],
    badges: badges || [],
    certificates: certificates || [],
    attendance: attendance || [],
  })

  try {
    const { text, provider } = await callAI([
      {
        role: 'system',
        content:
          'You are SkillTest_AI Command Chat, a precise training analytics assistant. Answer only from the provided database context. If data is missing, say what is missing. Keep answers concise, numeric, and actionable.',
      },
      {
        role: 'user',
        content: `DATABASE CONTEXT:\n${context}\n\nQUESTION:\n${message}`,
      },
    ], { maxTokens: 550, temperature: 0.2 })

    return NextResponse.json({ message: text, provider })
  } catch (error: any) {
    return NextResponse.json({
      message: localFallback(message, attempts || [], profiles || []),
      provider: 'skilltest_ai_local',
      error: error.message,
    })
  }
}

function buildChatbotContext(data: Record<string, any[]>) {
  const profileById = new Map(data.profiles.map((profile) => [profile.id, profile]))
  const rows = data.attempts.slice(0, 120).map((attempt) => {
    const profile = profileById.get(attempt.user_id)
    return [
      profile?.full_name || profile?.email || 'Unknown',
      profile?.employee_id || 'no-id',
      profile?.domain || profile?.department || 'General',
      attempt.quizzes?.title || 'Quiz',
      attempt.quizzes?.topic || 'General',
      `${attempt.score}%`,
      `${attempt.correct_answers}/${attempt.total_questions}`,
      `${attempt.points_earned || 0}pts`,
    ].join('|')
  })

  const quizSummary = data.quizzes.slice(0, 60).map((quiz) =>
    `${quiz.title}|${quiz.topic}|${quiz.difficulty}|pass=${quiz.passing_score}`
  )

  const badgeSummary = data.badges.slice(0, 80).map((entry) =>
    `${entry.user_id}|${entry.badges?.name}|${entry.badges?.category}|${entry.badges?.rarity}`
  )

  const certSummary = data.certificates.slice(0, 60).map((cert) =>
    `${cert.user_id}|${cert.title}|${cert.score}%|${cert.issued_at}`
  )

  return [
    'ATTEMPTS name|empId|domain|quiz|topic|score|correct|points',
    rows.join('\n') || 'none',
    'QUIZZES title|topic|difficulty|passing',
    quizSummary.join('\n') || 'none',
    'BADGES userId|badge|category|rarity',
    badgeSummary.join('\n') || 'none',
    'CERTIFICATES userId|title|score|issued',
    certSummary.join('\n') || 'none',
  ].join('\n')
}

function localFallback(message: string, attempts: any[], profiles: any[]) {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const top = attempts
    .slice()
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 5)
    .map((attempt, index) => {
      const profile = profileById.get(attempt.user_id)
      return `${index + 1}. ${profile?.full_name || profile?.email || 'Unknown'} scored ${attempt.score}% in ${attempt.quizzes?.title || 'quiz'}.`
    })
  return `AI provider was unavailable, so I used local summary mode for: "${message}".\n\n${top.join('\n') || 'No completed attempts found.'}`
}
