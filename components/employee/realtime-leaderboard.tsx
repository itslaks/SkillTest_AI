'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trophy, Flame, Star, Crown } from 'lucide-react'

interface LeaderboardEntry {
  user_id: string
  total_points: number
  tests_completed: number
  current_streak: number
  profiles: {
    full_name: string | null
    email: string
    department: string | null
  } | null
}

interface RealtimeLeaderboardProps {
  initialData: LeaderboardEntry[]
  currentUserId: string
}

export function RealtimeLeaderboard({ initialData, currentUserId }: RealtimeLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initialData)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const refreshLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('user_stats')
          .select('*, profiles:user_id(full_name, email, department)')
          .order('total_points', { ascending: false })
          .order('updated_at', { ascending: true }) // Earlier completion wins for same points
          .limit(100)

        if (error) {
          console.error('Leaderboard refresh error:', error)
          return
        }

        if (data) {
          setLeaderboard(data as any)
          setLastUpdated(new Date())
          setFlash(true)
          setTimeout(() => setFlash(false), 1000)
        }
      } catch (error) {
        console.error('Leaderboard refresh failed:', error)
      }
    }

    // Listen to both user_stats and quiz_attempts changes for immediate updates
    const channel = supabase
      .channel('realtime-leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_stats' },
        async () => {
          console.log('User stats changed - refreshing leaderboard')
          await refreshLeaderboard()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quiz_attempts' },
        async (payload) => {
          // Only refresh when quiz is completed
          if (payload.new?.status === 'completed' && payload.old?.status !== 'completed') {
            console.log('Quiz completed - refreshing leaderboard')
            // Add a small delay to ensure triggers have fired
            setTimeout(refreshLeaderboard, 500)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="space-y-4">
      {lastUpdated && (
        <div className={`flex items-center gap-2 text-xs text-emerald-600 font-medium transition-opacity ${flash ? 'opacity-100' : 'opacity-60'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live — last updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}
      {!lastUpdated && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live — updates automatically
        </div>
      )}

      {/* Top 3 Podium */}
      {leaderboard.length >= 3 && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border border-amber-200 shadow-sm p-6">
          <p className="text-center text-sm font-bold text-amber-800 mb-6 flex items-center justify-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />Top Performers
          </p>
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            {/* 2nd */}
            <div className="flex flex-col items-center gap-2 pt-8">
              <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-2xl ring-4 ring-slate-300 shadow-md">🥈</div>
              <p className="font-semibold text-sm text-center truncate w-full text-slate-700">
                {leaderboard[1].profiles?.full_name?.split(' ')[0] || 'User'}
                {leaderboard[1].user_id === currentUserId && <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded-full bg-blue-100 text-blue-700">You</span>}
              </p>
              <p className="text-xl font-bold text-slate-600">{leaderboard[1].total_points} <span className="text-xs font-normal text-muted-foreground">pts</span></p>
            </div>
            {/* 1st */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-full bg-yellow-200 flex items-center justify-center text-3xl ring-4 ring-yellow-400 shadow-lg">🥇</div>
              <p className="font-bold text-center truncate w-full text-amber-800">
                {leaderboard[0].profiles?.full_name?.split(' ')[0] || 'User'}
                {leaderboard[0].user_id === currentUserId && <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded-full bg-blue-100 text-blue-700">You</span>}
              </p>
              <p className="text-2xl font-bold text-yellow-600">{leaderboard[0].total_points} <span className="text-xs font-normal text-muted-foreground">pts</span></p>
            </div>
            {/* 3rd */}
            <div className="flex flex-col items-center gap-2 pt-12">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-xl ring-4 ring-amber-300 shadow-md">🥉</div>
              <p className="font-semibold text-sm text-center truncate w-full text-amber-700">
                {leaderboard[2].profiles?.full_name?.split(' ')[0] || 'User'}
                {leaderboard[2].user_id === currentUserId && <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded-full bg-blue-100 text-blue-700">You</span>}
              </p>
              <p className="text-lg font-bold text-amber-600">{leaderboard[2].total_points} <span className="text-xs font-normal text-muted-foreground">pts</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Full Rankings */}
      <div className="rounded-2xl bg-white border border-border/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/50 bg-muted/20">
          <h2 className="font-semibold">All Rankings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Based on total points earned — updates in real time</p>
        </div>
        <div className="divide-y divide-border/40">
          {leaderboard.length > 0 ? leaderboard.map((entry, i) => (
            <div
              key={entry.user_id}
              className={`flex items-center justify-between px-5 py-3.5 transition-all ${
                entry.user_id === currentUserId ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-muted/20'
              } ${flash && i < 3 ? 'bg-emerald-50/50' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-300'
                  : i === 1 ? 'bg-slate-100 text-slate-700 ring-2 ring-slate-300'
                  : i === 2 ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                  : 'bg-muted text-muted-foreground'
                }`}>{i + 1}</div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' : 'bg-gradient-to-br from-blue-400 to-violet-500'}`}>
                  {entry.profiles?.full_name?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {entry.profiles?.full_name || 'Unknown'}
                    {entry.user_id === currentUserId && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">You</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{entry.profiles?.department || 'Employee'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                  <Star className="h-3 w-3" /><span className="text-xs font-bold">{entry.total_points}</span>
                </div>
                {entry.current_streak > 0 && (
                  <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-600 border border-orange-100">
                    <Flame className="h-3 w-3" /><span className="text-xs font-medium">{entry.current_streak}</span>
                  </div>
                )}
                <div className="hidden sm:flex items-center gap-1 text-muted-foreground text-xs">
                  <Trophy className="h-3 w-3 text-blue-400" /><span>{entry.tests_completed}</span>
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-16">
              <Trophy className="h-14 w-14 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold mb-1">No Rankings Yet</h3>
              <p className="text-sm text-muted-foreground">Complete quizzes to appear on the leaderboard!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
