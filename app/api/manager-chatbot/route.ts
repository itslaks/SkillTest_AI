import { NextRequest, NextResponse } from 'next/server'
import { requireTrainingStaffForApi } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'
import { getAccessibleTrainingBatchIds } from '@/lib/training-access'
import { callAI } from '@/lib/ai'
import { analyzeAttemptPattern } from '@/lib/insights'
import { buildAdminGuideSearchIndex, findAdminGuideAnswer } from '@/lib/manager-docs'
import type { DifficultyLevel, QuizAnswer } from '@/lib/types/database'

export async function POST(request: NextRequest) {
  const auth = await requireTrainingStaffForApi()
  if (auth instanceof NextResponse) return auth

  const { message } = await request.json()
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }

  const docsAnswer = findAdminGuideAnswer(message)
  if (docsAnswer) {
    return NextResponse.json({ message: docsAnswer, provider: 'skilltest_ai_docs' })
  }

  const admin = createAdminClient()
  const batchIds = await getAccessibleTrainingBatchIds(auth.userId, auth.role)

  const [
    { data: quizzes },
    { data: attempts },
    { data: profiles },
    { data: badges },
    { data: certificates },
    { data: certificateRules },
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
      .from('certificate_rules')
      .select('quiz_id, enabled, min_score, title, certificate_name, quizzes:quiz_id(title, topic)')
      .limit(120),
    admin
      .from('session_attendance')
      .select('user_id, status, session:session_id(batch_id, title, session_date)')
      .limit(500),
  ])

  const data = {
    quizzes: quizzes || [],
    attempts: attempts || [],
    profiles: profiles || [],
    badges: badges || [],
    certificates: certificates || [],
    certificateRules: certificateRules || [],
    attendance: attendance || [],
  }

  const deterministicAnswer = buildDeterministicAnswer(message, data)
  if (deterministicAnswer) {
    return NextResponse.json({ message: deterministicAnswer, provider: 'skilltest_ai_stats' })
  }

  const context = buildChatbotContext(data)
  const docsContext = buildAdminGuideSearchIndex()

  try {
    const { text, provider } = await callAI([
      {
        role: 'system',
        content:
          'You are SkillTest_AI Command Chat. Use only the provided database context and admin guide context. Never invent numbers, names, attempts, scores, or certificates. If exact data is missing, say so. For how-to questions, answer from the admin guide. Keep responses under 80 words, with at most 4 bullets. Use crisp plain text and avoid markdown decoration unless it improves readability.',
      },
      {
        role: 'user',
        content: `DATABASE CONTEXT:\n${context}\n\nADMIN GUIDE CONTEXT:\n${docsContext}\n\nQUESTION:\n${message}`,
      },
    ], { maxTokens: 180, temperature: 0.1 })

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
    const behavior = analyzeAttemptPattern((attempt.answers || []) as QuizAnswer[], attempt.quizzes?.difficulty as DifficultyLevel)
    return [
      profile?.full_name || profile?.email || 'Unknown',
      profile?.employee_id || 'no-id',
      profile?.domain || profile?.department || 'General',
      attempt.quizzes?.title || 'Quiz',
      attempt.quizzes?.topic || 'General',
      `${attempt.score}%`,
      `${attempt.correct_answers}/${attempt.total_questions}`,
      `${attempt.points_earned || 0}pts`,
      `focus=${behavior.focusScore}`,
      `risk=${behavior.riskLevel}`,
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
  const certRuleSummary = data.certificateRules.slice(0, 80).map((rule) =>
    `${rule.quizzes?.title || rule.quiz_id}|${rule.quizzes?.topic || 'General'}|enabled=${rule.enabled}|min=${rule.min_score}|name=${rule.certificate_name || rule.title}`
  )

  return [
    'ATTEMPTS name|empId|domain|quiz|topic|score|correct|points|focus|risk',
    rows.join('\n') || 'none',
    'QUIZZES title|topic|difficulty|passing',
    quizSummary.join('\n') || 'none',
    'BADGES userId|badge|category|rarity',
    badgeSummary.join('\n') || 'none',
    'CERTIFICATES userId|title|score|issued',
    certSummary.join('\n') || 'none',
    'CERTIFICATE_RULES quiz|topic|enabled|minScore|certificateName',
    certRuleSummary.join('\n') || 'none',
  ].join('\n')
}

function buildDeterministicAnswer(message: string, data: Record<string, any[]>) {
  const lower = normalize(message)
  const profile = findProfile(lower, data.profiles)
  const quiz = findQuiz(lower, data.quizzes, data.attempts)

  if ((lower.includes('average') || lower.includes('avg')) && lower.includes('score')) {
    const quizAverage = quiz ? summarizeQuiz(quiz, data.attempts, data.certificateRules) : null
    if (quizAverage) return quizAverage
  }

  if (profile && quiz) {
    return summarizeEmployeeQuiz(profile, quiz, data.attempts)
  }

  if (profile && (lower.includes('score') || lower.includes('analysis') || lower.includes('performance'))) {
    return summarizeEmployee(profile, data.attempts)
  }

  if (quiz && (lower.includes('score') || lower.includes('analysis') || lower.includes('performance') || lower.includes('pass'))) {
    return summarizeQuiz(quiz, data.attempts, data.certificateRules)
  }

  if (lower.includes('certificate')) {
    return summarizeCertificates(data.profiles, data.attempts, data.certificateRules, data.certificates)
  }

  if (lower.includes('weak') || lower.includes('lowest') || lower.includes('risk')) {
    return summarizeWeakAreas(data.attempts)
  }

  return null
}

function summarizeEmployeeQuiz(profile: any, quiz: any, attempts: any[]) {
  const matches = attempts
    .filter((attempt) => attempt.user_id === profile.id && attempt.quiz_id === quiz.id)
    .sort(byLatest)
  const attempt = matches[0]
  if (!attempt) {
    return `No completed attempt found for ${displayName(profile)} in ${quiz.title}.`
  }
  const behavior = analyzeAttemptPattern((attempt.answers || []) as QuizAnswer[], attempt.quizzes?.difficulty as DifficultyLevel)
  return [
    `${displayName(profile)} scored ${attempt.score}% in ${quiz.title}.`,
    `Correct: ${attempt.correct_answers}/${attempt.total_questions}; avg answer time: ${behavior.averageAnswerTime}s.`,
    `Behavior: ${behavior.riskLevel} risk, focus ${behavior.focusScore}%, confidence ${behavior.confidenceScore}%. ${behavior.masterySignal}`,
  ].join('\n')
}

function summarizeEmployee(profile: any, attempts: any[]) {
  const rows = attempts.filter((attempt) => attempt.user_id === profile.id)
  if (!rows.length) return `No completed quiz attempts found for ${displayName(profile)}.`
  const avg = average(rows.map((attempt) => Number(attempt.score || 0)))
  const latest = rows.slice().sort(byLatest)[0]
  return `${displayName(profile)} average score is ${avg}% across ${rows.length} completed quiz(es). Latest: ${latest.quizzes?.title || 'quiz'} ${latest.score}%.`
}

function summarizeQuiz(quiz: any, attempts: any[], rules: any[]) {
  const rows = attempts.filter((attempt) => attempt.quiz_id === quiz.id)
  if (!rows.length) return `No completed attempts found for ${quiz.title}.`
  const avg = average(rows.map((attempt) => Number(attempt.score || 0)))
  const passLine = Number(quiz.passing_score || 60)
  const passRate = Math.round((rows.filter((attempt) => Number(attempt.score || 0) >= passLine).length / rows.length) * 100)
  const certRule = rules.find((rule) => rule.quiz_id === quiz.id)
  const certText = certRule?.enabled ? ` Certificate threshold: ${certRule.min_score}%.` : ''
  return `${quiz.title} average score is ${avg}% from ${rows.length} completed attempt(s). Pass rate: ${passRate}% at ${passLine}%.${certText}`
}

function summarizeCertificates(profiles: any[], attempts: any[], rules: any[], certificates: any[]) {
  const enabledRules = rules.filter((rule) => rule.enabled)
  if (!enabledRules.length) return 'No certificate rules are enabled. Enable a rule for the required quiz before certificates can be issued.'
  const certKeys = new Set(certificates.map((cert) => `${cert.quiz_id}:${cert.user_id}`))
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const eligibleMissing = attempts.filter((attempt) => {
    const rule = enabledRules.find((item) => item.quiz_id === attempt.quiz_id)
    return rule && Number(attempt.score || 0) >= Number(rule.min_score || 0) && !certKeys.has(`${attempt.quiz_id}:${attempt.user_id}`)
  })
  if (!eligibleMissing.length) return `Certificate rules are active for ${enabledRules.length} quiz(es). All eligible loaded attempts already have certificates.`
  const names = eligibleMissing.slice(0, 5).map((attempt) => `${displayName(profileById.get(attempt.user_id))} scored ${attempt.score}%`)
  return `${eligibleMissing.length} eligible certificate(s) need review. Priority candidates: ${names.join(', ')}.`
}

function summarizeWeakAreas(attempts: any[]) {
  const byTopic = new Map<string, number[]>()
  for (const attempt of attempts) {
    const topic = attempt.quizzes?.topic || attempt.quizzes?.title || 'General'
    byTopic.set(topic, [...(byTopic.get(topic) || []), Number(attempt.score || 0)])
  }
  const weakest = [...byTopic.entries()]
    .map(([topic, scores]) => ({ topic, avg: average(scores), count: scores.length }))
    .sort((a, b) => a.avg - b.avg)[0]
  if (!weakest) return 'No completed attempts found to identify weak areas.'
  return `Weakest loaded topic: ${weakest.topic}, average ${weakest.avg}% across ${weakest.count} attempt(s).`
}

function findProfile(query: string, profiles: any[]) {
  const tokens = significantTokens(query)
  return profiles.find((profile) => {
    const haystack = normalize([profile.full_name, profile.email, profile.employee_id].filter(Boolean).join(' '))
    return tokens.some((token) => token.length >= 3 && haystack.includes(token))
  })
}

function findQuiz(query: string, quizzes: any[], attempts: any[]) {
  const quizPool = quizzes.length
    ? quizzes
    : uniqueBy(attempts.map((attempt) => ({
        id: attempt.quiz_id,
        title: attempt.quizzes?.title,
        topic: attempt.quizzes?.topic,
        difficulty: attempt.quizzes?.difficulty,
      })), 'id')
  const tokens = significantTokens(query)
  return quizPool.find((quiz) => {
    const haystack = normalize([quiz.title, quiz.topic].filter(Boolean).join(' '))
    return tokens.some((token) => token.length >= 3 && haystack.includes(token))
  })
}

function significantTokens(value: string) {
  const stop = new Set(['score', 'analysis', 'average', 'avg', 'quiz', 'test', 'of', 'in', 'for', 'the', 'and', 'performance', 'show', 'tell', 'me'])
  return normalize(value).split(/\s+/).filter((token) => token && !stop.has(token))
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9@._ -]/g, ' ').replace(/\s+/g, ' ').trim()
}

function displayName(profile: any) {
  return profile?.full_name || profile?.email || 'Unknown employee'
}

function average(values: number[]) {
  if (!values.length) return 0
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function byLatest(left: any, right: any) {
  return new Date(right.completed_at || 0).getTime() - new Date(left.completed_at || 0).getTime()
}

function uniqueBy(items: any[], key: string) {
  const seen = new Set()
  return items.filter((item) => {
    const value = item[key]
    if (!value || seen.has(value)) return false
    seen.add(value)
    return true
  })
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
  return `Current performance summary for "${message}":\n\n${top.join('\n') || 'No completed attempts found in the loaded records.'}`
}
