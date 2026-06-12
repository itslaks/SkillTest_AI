export interface LeaderboardProfile {
  full_name: string | null
  email: string
  employee_id: string | null
  department: string | null
  avatar_url?: string | null
}

export interface CumulativeAttempt {
  user_id: string
  score: number | null
  correct_answers: number | null
  total_questions: number | null
  time_taken_seconds: number | null
  points_earned: number | null
  completed_at?: string | null
  profiles?: LeaderboardProfile | LeaderboardProfile[] | null
}

export interface CumulativeLeaderboardEntry {
  user_id: string
  full_name: string
  email: string
  employee_id: string | null
  department: string | null
  avatar_url: string | null
  total_points: number
  total_quizzes: number
  avg_score: number
  total_correct: number
  total_questions: number
  total_time: number
  rank: number
  earliest_completion?: string
  latest_completion?: string
  first_quiz_completed?: string
}

function firstJoinedProfile(
  profile: LeaderboardProfile | LeaderboardProfile[] | null | undefined,
): LeaderboardProfile | null {
  return Array.isArray(profile) ? profile[0] ?? null : profile ?? null
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '-'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

export function buildCumulativeLeaderboard(
  attempts: CumulativeAttempt[] | null | undefined,
): CumulativeLeaderboardEntry[] {
  const userAggregates = new Map<string, Omit<CumulativeLeaderboardEntry, 'rank'>>()

  for (const attempt of attempts ?? []) {
    const existing = userAggregates.get(attempt.user_id)
    const profile = firstJoinedProfile(attempt.profiles)
    const correctAnswers = attempt.correct_answers ?? 0
    const totalQuestions = attempt.total_questions ?? 0
    const timeTaken = attempt.time_taken_seconds ?? 0
    const pointsEarned = attempt.points_earned ?? 0
    const completedAt = attempt.completed_at ?? undefined

    if (existing) {
      existing.total_points += pointsEarned
      existing.total_quizzes += 1
      existing.total_correct += correctAnswers
      existing.total_questions += totalQuestions
      existing.total_time += timeTaken
      existing.avg_score = existing.total_questions > 0
        ? Math.round((existing.total_correct / existing.total_questions) * 100)
        : 0

      if (completedAt && (!existing.earliest_completion || new Date(completedAt) < new Date(existing.earliest_completion))) {
        existing.earliest_completion = completedAt
      }
      if (completedAt && (!existing.latest_completion || new Date(completedAt) > new Date(existing.latest_completion))) {
        existing.latest_completion = completedAt
      }
      if (completedAt && !existing.first_quiz_completed) {
        existing.first_quiz_completed = completedAt
      }

      continue
    }

    userAggregates.set(attempt.user_id, {
      user_id: attempt.user_id,
      full_name: profile?.full_name || 'Unknown',
      email: profile?.email || '',
      employee_id: profile?.employee_id || null,
      department: profile?.department || null,
      avatar_url: profile?.avatar_url || null,
      total_points: pointsEarned,
      total_quizzes: 1,
      total_correct: correctAnswers,
      total_questions: totalQuestions,
      total_time: timeTaken,
      avg_score: attempt.score ?? 0,
      earliest_completion: completedAt,
      latest_completion: completedAt,
      first_quiz_completed: completedAt,
    })
  }

  return Array.from(userAggregates.values())
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points
      if (b.avg_score !== a.avg_score) return b.avg_score - a.avg_score

      const aCompleted = a.earliest_completion ? new Date(a.earliest_completion).getTime() : Number.MAX_SAFE_INTEGER
      const bCompleted = b.earliest_completion ? new Date(b.earliest_completion).getTime() : Number.MAX_SAFE_INTEGER
      if (aCompleted !== bCompleted) return aCompleted - bCompleted

      return a.total_time - b.total_time
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}
