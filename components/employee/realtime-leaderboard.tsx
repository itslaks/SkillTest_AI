'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trophy, Flame, Star, Crown, Medal } from 'lucide-react'
import { buildCumulativeLeaderboard, type CumulativeAttempt, type CumulativeLeaderboardEntry } from '@/lib/leaderboard'

interface RealtimeLeaderboardProps {
  initialData: CumulativeLeaderboardEntry[]
  currentUserId: string
}

export function RealtimeLeaderboard({ initialData, currentUserId }: RealtimeLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<CumulativeLeaderboardEntry[]>(initialData)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    let flashTimer: ReturnType<typeof setTimeout> | null = null
    let intervalTimer: ReturnType<typeof setInterval> | null = null

    const refreshLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('quiz_attempts')
          .select(`
            user_id,
            score,
            correct_answers,
            total_questions,
            time_taken_seconds,
            points_earned,
            completed_at,
            profiles:user_id(full_name, email, department, employee_id, avatar_url)
          `)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1000)

        if (error) {
          console.error('Leaderboard refresh error:', error)
          return
        }

        setLeaderboard(buildCumulativeLeaderboard(data as CumulativeAttempt[]))
        setLastUpdated(new Date())
        setFlash(true)
        if (flashTimer) clearTimeout(flashTimer)
        flashTimer = setTimeout(() => setFlash(false), 1200)
      } catch (error) {
        console.error('Leaderboard refresh failed:', error)
      }
    }

    const scheduleRefresh = (delay = 500) => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(refreshLeaderboard, delay)
    }

    const channel = supabase
      .channel(`realtime-leaderboard-${currentUserId}`)
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
  }, [currentUserId])

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
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-6 shadow-sm">
          <p className="mb-6 flex items-center justify-center gap-2 text-center text-sm font-bold text-amber-800">
            <Crown className="h-4 w-4 text-amber-500" />
            Top Performers
          </p>
          <div className="mx-auto grid max-w-2xl grid-cols-3 gap-4">
            <PodiumSpot entry={leaderboard[1]} rank={2} currentUserId={currentUserId} />
            <PodiumSpot entry={leaderboard[0]} rank={1} currentUserId={currentUserId} />
            <PodiumSpot entry={leaderboard[2]} rank={3} currentUserId={currentUserId} />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm">
        <div className="border-b border-border/50 bg-muted/20 px-6 py-4">
          <h2 className="font-semibold">All Rankings</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Sorted by total points, then score quality and completion timing.</p>
        </div>
        <div className="divide-y divide-border/40">
          {leaderboard.length > 0 ? leaderboard.map((entry, index) => (
            <div
              key={entry.user_id}
              className={`flex items-center justify-between px-5 py-3.5 transition-all ${
                entry.user_id === currentUserId ? 'border-l-4 border-l-blue-500 bg-blue-50' : 'hover:bg-muted/20'
              } ${flash && index < 3 ? 'bg-emerald-50/50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-300'
                  : index === 1 ? 'bg-slate-100 text-slate-700 ring-2 ring-slate-300'
                  : index === 2 ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                  : 'bg-muted text-muted-foreground'
                }`}>
                  {entry.rank}
                </div>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${
                  index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' : 'bg-gradient-to-br from-blue-400 to-violet-500'
                }`}>
                  {entry.full_name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {entry.full_name || 'Unknown'}
                    {entry.user_id === currentUserId && (
                      <span className="ml-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">You</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{entry.department || 'Employee'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1 text-amber-700">
                  <Star className="h-3 w-3" />
                  <span className="text-xs font-bold">{entry.total_points}</span>
                </div>
                <div className="hidden items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-blue-700 sm:flex">
                  <Trophy className="h-3 w-3" />
                  <span className="text-xs font-medium">{entry.total_quizzes}</span>
                </div>
                {entry.total_quizzes > 0 && (
                  <div className="hidden items-center gap-1 rounded-lg border border-orange-100 bg-orange-50 px-2.5 py-1 text-orange-600 sm:flex">
                    <Flame className="h-3 w-3" />
                    <span className="text-xs font-medium">{entry.avg_score}%</span>
                  </div>
                )}
              </div>
            </div>
          )) : (
            <div className="py-16 text-center">
              <Trophy className="mx-auto mb-3 h-14 w-14 text-muted-foreground/30" />
              <h3 className="mb-1 font-semibold">No rankings yet</h3>
              <p className="text-sm text-muted-foreground">Complete a quiz to appear on the live leaderboard.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PodiumSpot({
  entry,
  rank,
  currentUserId,
}: {
  entry: CumulativeLeaderboardEntry
  rank: 1 | 2 | 3
  currentUserId: string
}) {
  const config = {
    1: {
      shell: 'h-20 w-20 bg-yellow-200 ring-yellow-400 text-yellow-700',
      points: 'text-2xl text-yellow-600',
      name: 'text-amber-800 font-bold',
      offset: '',
    },
    2: {
      shell: 'h-16 w-16 bg-slate-200 ring-slate-300 text-slate-700',
      points: 'text-xl text-slate-600',
      name: 'text-slate-700 font-semibold',
      offset: 'pt-8',
    },
    3: {
      shell: 'h-14 w-14 bg-amber-100 ring-amber-300 text-amber-700',
      points: 'text-lg text-amber-600',
      name: 'text-amber-700 font-semibold',
      offset: 'pt-12',
    },
  }[rank]

  return (
    <div className={`flex flex-col items-center gap-2 ${config.offset}`}>
      <div className={`flex items-center justify-center rounded-full ring-4 shadow-md ${config.shell}`}>
        <Medal className="h-7 w-7" />
      </div>
      <p className={`w-full truncate text-center text-sm ${config.name}`}>
        {entry.full_name.split(' ')[0] || 'User'}
        {entry.user_id === currentUserId && (
          <span className="ml-1 rounded-full bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700">You</span>
        )}
      </p>
      <p className={`font-bold ${config.points}`}>
        {entry.total_points} <span className="text-xs font-normal text-muted-foreground">pts</span>
      </p>
    </div>
  )
}
