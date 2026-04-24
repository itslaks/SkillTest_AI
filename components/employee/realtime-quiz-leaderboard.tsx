'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Trophy, Clock, Crown, ArrowLeft, Users, Medal, Target } from 'lucide-react'
import type { LeaderboardEntry } from '@/lib/types/database'

interface RealtimeQuizLeaderboardProps {
  quizId: string
  quiz: {
    title: string
    topic: string
    difficulty: string
  }
  initialData: LeaderboardEntry[]
  currentUserId: string
}

export function RealtimeQuizLeaderboard({
  quizId,
  quiz,
  initialData,
  currentUserId,
}: RealtimeQuizLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initialData)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    let intervalTimer: ReturnType<typeof setInterval> | null = null

    const refreshLeaderboard = async () => {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select(`
          *,
          profiles:user_id(full_name, email, employee_id, avatar_url, department)
        `)
        .eq('quiz_id', quizId)
        .eq('status', 'completed')
        .order('score', { ascending: false })
        .order('completed_at', { ascending: true })
        .order('time_taken_seconds', { ascending: true })

      if (error) {
        console.error('Quiz leaderboard refresh error:', error)
        return
      }

      const mapped = (data || []).map((entry: any, index: number) => ({
        user_id: entry.user_id,
        full_name: entry.profiles?.full_name || 'Unknown',
        email: entry.profiles?.email || '',
        employee_id: entry.profiles?.employee_id || null,
        avatar_url: entry.profiles?.avatar_url || null,
        department: entry.profiles?.department || null,
        score: entry.score,
        correct_answers: entry.correct_answers,
        total_questions: entry.total_questions,
        time_taken_seconds: entry.time_taken_seconds,
        points_earned: entry.points_earned,
        completed_at: entry.completed_at,
        rank: index + 1,
      })) as LeaderboardEntry[]

      setLeaderboard(mapped)
      setLastUpdated(new Date())
    }

    const scheduleRefresh = (delay = 500) => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(refreshLeaderboard, delay)
    }

    const channel = supabase
      .channel(`quiz-leaderboard-${quizId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_attempts' },
        (payload) => {
          const sameQuiz = typeof payload.new === 'object' && payload.new && 'quiz_id' in payload.new && payload.new.quiz_id === quizId
          const newStatus = typeof payload.new === 'object' && payload.new && 'status' in payload.new ? payload.new.status : null
          const oldStatus = typeof payload.old === 'object' && payload.old && 'status' in payload.old ? payload.old.status : null

          if (sameQuiz && newStatus === 'completed' && oldStatus !== 'completed') {
            scheduleRefresh(800)
          }
        }
      )
      .subscribe()

    intervalTimer = setInterval(() => {
      refreshLeaderboard()
    }, 120000)

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      if (intervalTimer) clearInterval(intervalTimer)
      supabase.removeChannel(channel)
    }
  }, [quizId])

  const userEntry = useMemo(
    () => leaderboard.find((entry) => entry.user_id === currentUserId),
    [leaderboard, currentUserId]
  )
  const totalParticipants = leaderboard.length
  const avgScore = totalParticipants > 0
    ? Math.round(leaderboard.reduce((sum, entry) => sum + entry.score, 0) / totalParticipants)
    : 0
  const avgTime = totalParticipants > 0
    ? Math.round(leaderboard.reduce((sum, entry) => sum + entry.time_taken_seconds, 0) / totalParticipants)
    : 0

  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-blue-100 text-blue-700',
    hard: 'bg-amber-100 text-amber-700',
    advanced: 'bg-orange-100 text-orange-700',
    hardcore: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/employee/quizzes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Crown className="h-8 w-8 text-yellow-500" />
            {quiz.title} Leaderboard
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{quiz.topic}</span>
            <Badge variant="secondary" className={difficultyColors[quiz.difficulty] || ''}>
              {quiz.difficulty}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-emerald-600">
            {lastUpdated
              ? `Live leaderboard refreshed at ${lastUpdated.toLocaleTimeString()}`
              : 'Live leaderboard updates on each completion and every 2 minutes.'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5 text-white" />} shell="from-yellow-500 to-amber-600" value={String(totalParticipants)} label="Participants" />
        <StatCard icon={<Target className="h-5 w-5 text-white" />} shell="from-green-500 to-emerald-600" value={`${avgScore}%`} label="Average Score" />
        <StatCard icon={<Clock className="h-5 w-5 text-white" />} shell="from-blue-500 to-indigo-600" value={formatTime(avgTime)} label="Avg Time" />
        {userEntry && (
          <StatCard icon={<Medal className="h-5 w-5 text-white" />} shell="from-purple-500 to-violet-600" value={`#${userEntry.rank}`} label="Your Rank" accent="border-purple-200" />
        )}
      </div>

      {leaderboard.length >= 3 && (
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-4">
          <QuizPodiumSpot entry={leaderboard[1]} rank={2} />
          <QuizPodiumSpot entry={leaderboard[0]} rank={1} />
          <QuizPodiumSpot entry={leaderboard[2]} rank={3} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            All Rankings
          </CardTitle>
          <CardDescription>{totalParticipants} participants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <div
                key={entry.user_id}
                className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                  entry.user_id === currentUserId
                    ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    entry.rank === 1 ? 'bg-yellow-100 text-yellow-700'
                    : entry.rank === 2 ? 'bg-gray-100 text-gray-700'
                    : entry.rank === 3 ? 'bg-amber-100 text-amber-700'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    {entry.rank}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {entry.full_name}
                      {entry.user_id === currentUserId && (
                        <Badge variant="default" className="ml-2 px-1.5 text-[10px]">YOU</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{entry.department || 'Employee'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <span className="font-bold">{entry.score}%</span>
                    <p className="text-xs text-muted-foreground">{entry.correct_answers}/{entry.total_questions}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(entry.time_taken_seconds)}
                    </span>
                  </div>
                  <Badge variant="secondary">{entry.points_earned} pts</Badge>
                </div>
              </div>
            ))}

            {leaderboard.length === 0 && (
              <div className="py-12 text-center">
                <Trophy className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-semibold">No rankings yet</h3>
                <p className="text-muted-foreground">
                  Be the first to complete this quiz.
                </p>
                <Button className="mt-4" asChild>
                  <Link href={`/employee/quizzes/${quizId}`}>Take Quiz</Link>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function formatTime(seconds: number) {
  if (!seconds) return '-'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder}s`
}

function StatCard({
  icon,
  shell,
  value,
  label,
  accent = '',
}: {
  icon: ReactNode
  shell: string
  value: string
  label: string
  accent?: string
}) {
  return (
    <Card className={`bg-gradient-to-br ${accent}`}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg bg-gradient-to-br p-2 ${shell}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function QuizPodiumSpot({
  entry,
  rank,
}: {
  entry: LeaderboardEntry
  rank: 1 | 2 | 3
}) {
  const styles = {
    1: 'h-20 w-20 bg-yellow-100 ring-yellow-400 text-3xl text-yellow-700',
    2: 'h-16 w-16 bg-gray-100 ring-gray-300 text-2xl text-gray-700',
    3: 'h-14 w-14 bg-amber-100 ring-amber-400 text-xl text-amber-700',
  }[rank]

  return (
    <div className={`flex flex-col items-center ${rank === 2 ? 'pt-8' : rank === 3 ? 'pt-12' : ''}`}>
      <div className={`mb-2 flex items-center justify-center rounded-full ring-4 shadow-lg ${styles}`}>
        <span className="font-bold">{rank}</span>
      </div>
      <p className="w-full truncate text-center text-sm font-medium">{entry.full_name}</p>
      <p className="text-2xl font-bold text-yellow-600">{entry.score}%</p>
      <p className="text-xs text-muted-foreground">{formatTime(entry.time_taken_seconds)}</p>
    </div>
  )
}
