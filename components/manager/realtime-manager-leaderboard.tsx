'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Users } from 'lucide-react'
import { buildCumulativeLeaderboard, formatDuration, type CumulativeAttempt, type CumulativeLeaderboardEntry } from '@/lib/leaderboard'

type ManagerLeaderboardEntry = CumulativeLeaderboardEntry

interface RealtimeManagerLeaderboardProps {
  initialData: ManagerLeaderboardEntry[]
  managerId: string
}

export function RealtimeManagerLeaderboard({
  initialData,
  managerId,
}: RealtimeManagerLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<ManagerLeaderboardEntry[]>(initialData)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    let flashTimer: ReturnType<typeof setTimeout> | null = null
    let intervalTimer: ReturnType<typeof setInterval> | null = null

    const refreshLeaderboard = async () => {
      try {
        const { data: globalLeaderboard, error } = await supabase
          .from('quiz_attempts')
          .select(`
            user_id,
            score,
            correct_answers,
            total_questions,
            time_taken_seconds,
            points_earned,
            completed_at,
            quizzes!inner(created_by, title),
            profiles:user_id(full_name, email, employee_id, department)
          `)
          .eq('quizzes.created_by', managerId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })

        if (error) {
          console.error('Manager leaderboard refresh error:', error)
          return
        }

        setLeaderboard(buildCumulativeLeaderboard(globalLeaderboard as CumulativeAttempt[]))
        setLastUpdated(new Date())
        setFlash(true)
        if (flashTimer) clearTimeout(flashTimer)
        flashTimer = setTimeout(() => setFlash(false), 1000)
      } catch (error) {
        console.error('Manager leaderboard refresh failed:', error)
      }
    }

    const scheduleRefresh = (delay = 500) => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(refreshLeaderboard, delay)
    }

    const channel = supabase
      .channel(`manager-leaderboard-${managerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_attempts' },
        (payload) => {
          const newStatus = typeof payload.new === 'object' && payload.new && 'status' in payload.new ? payload.new.status : null
          const oldStatus = typeof payload.old === 'object' && payload.old && 'status' in payload.old ? payload.old.status : null

          if (newStatus === 'completed' && oldStatus !== 'completed') {
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
      if (flashTimer) clearTimeout(flashTimer)
      if (intervalTimer) clearInterval(intervalTimer)
      supabase.removeChannel(channel)
    }
  }, [managerId])

  return (
    <div className="space-y-4">
      {lastUpdated ? (
        <div className={`flex items-center gap-2 text-xs font-medium text-emerald-600 transition-opacity ${flash ? 'opacity-100' : 'opacity-70'}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live leaderboard, last updated {lastUpdated.toLocaleTimeString()}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live leaderboard updates on each completion and every 2 minutes.
        </div>
      )}

      {leaderboard.length >= 3 && (
        <Card className="border border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-sm font-bold text-amber-800">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="mx-auto grid max-w-2xl grid-cols-3 gap-4">
              <ManagerPodiumSpot entry={leaderboard[1]} rank={2} />
              <ManagerPodiumSpot entry={leaderboard[0]} rank={1} />
              <ManagerPodiumSpot entry={leaderboard[2]} rank={3} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.user_id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-all hover:bg-muted/50 ${
                    flash && index < 3 ? 'bg-emerald-50/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-300'
                      : index === 1 ? 'bg-slate-100 text-slate-700 ring-2 ring-slate-300'
                      : index === 2 ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                      : 'bg-muted text-muted-foreground'
                    }`}>
                      {entry.rank}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{entry.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.email} • {entry.department || 'No Dept'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-primary">{entry.total_points}</p>
                      <p className="text-xs text-muted-foreground">Points</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{entry.avg_score}%</p>
                      <p className="text-xs text-muted-foreground">Avg Score</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{entry.total_quizzes}</p>
                      <p className="text-xs text-muted-foreground">Quizzes</p>
                    </div>
                    <div className="hidden text-center sm:block">
                      <p className="font-semibold">{formatDuration(entry.total_time)}</p>
                      <p className="text-xs text-muted-foreground">Total Time</p>
                    </div>
                    <div className="hidden text-center md:block">
                      <p className="text-xs font-semibold">
                        {entry.latest_completion
                          ? new Date(entry.latest_completion).toLocaleDateString()
                          : '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">Last Quiz</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Trophy className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No data yet</h3>
              <p className="text-muted-foreground">
                Employees will appear here after completing quizzes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ManagerPodiumSpot({
  entry,
  rank,
}: {
  entry: ManagerLeaderboardEntry
  rank: 1 | 2 | 3
}) {
  const config = {
    1: {
      shell: 'h-20 w-20 bg-yellow-200 ring-yellow-400 text-xl',
      points: 'text-2xl text-yellow-600',
      name: 'font-bold text-amber-800',
      offset: '',
    },
    2: {
      shell: 'h-16 w-16 bg-slate-200 ring-slate-300 text-lg',
      points: 'text-xl text-slate-600',
      name: 'font-semibold text-slate-700',
      offset: 'pt-8',
    },
    3: {
      shell: 'h-14 w-14 bg-amber-100 ring-amber-300 text-base',
      points: 'text-lg text-amber-600',
      name: 'font-semibold text-amber-700',
      offset: 'pt-12',
    },
  }[rank]

  return (
    <div className={`flex flex-col items-center ${config.offset}`}>
      <div className={`flex items-center justify-center rounded-full ring-4 shadow-md ${config.shell}`}>
        <span className="font-bold">{rank}</span>
      </div>
      <p className={`mt-2 w-full truncate text-center text-sm ${config.name}`}>
        {entry.full_name.split(' ')[0] || 'User'}
      </p>
      <p className={`font-bold ${config.points}`}>
        {entry.total_points} <span className="text-xs font-normal text-muted-foreground">pts</span>
      </p>
    </div>
  )
}
