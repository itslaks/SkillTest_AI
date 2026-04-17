'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Users, TrendingUp, Clock } from 'lucide-react'

interface ManagerLeaderboardEntry {
  user_id: string
  full_name: string
  email: string
  employee_id: string | null
  department: string | null
  total_points: number
  total_quizzes: number
  avg_score: number
  total_correct: number
  total_questions: number
  total_time: number
  rank: number
}

interface RealtimeManagerLeaderboardProps {
  initialData: ManagerLeaderboardEntry[]
  managerId: string
}

export function RealtimeManagerLeaderboard({ 
  initialData, 
  managerId 
}: RealtimeManagerLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<ManagerLeaderboardEntry[]>(initialData)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const refreshLeaderboard = async () => {
      try {
        console.log('Refreshing manager leaderboard data...')
        
        // Fetch updated leaderboard data for this manager's quizzes
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
            quizzes!inner(created_by),
            profiles:user_id(full_name, email, employee_id, department)
          `)
          .eq('quizzes.created_by', managerId)
          .eq('status', 'completed')
          .order('points_earned', { ascending: false })

        if (error) {
          console.error('Manager leaderboard refresh error:', error)
          return
        }

        // Aggregate by user
        const userAggregates = new Map<string, any>()

        globalLeaderboard?.forEach((attempt: any) => {
          const userId = attempt.user_id
          const existing = userAggregates.get(userId)
          
          if (existing) {
            existing.total_points += attempt.points_earned || 0
            existing.total_quizzes += 1
            existing.total_correct += attempt.correct_answers || 0
            existing.total_questions += attempt.total_questions || 0
            existing.total_time += attempt.time_taken_seconds || 0
            existing.avg_score = existing.total_questions > 0 
              ? Math.round((existing.total_correct / existing.total_questions) * 100) 
              : 0
            // Track earliest completion for tiebreaking
            if (new Date(attempt.completed_at) < new Date(existing.earliest_completion)) {
              existing.earliest_completion = attempt.completed_at
            }
          } else {
            userAggregates.set(userId, {
              user_id: userId,
              full_name: attempt.profiles?.full_name || 'Unknown',
              email: attempt.profiles?.email || '',
              employee_id: attempt.profiles?.employee_id || null,
              department: attempt.profiles?.department || null,
              total_points: attempt.points_earned || 0,
              total_quizzes: 1,
              total_correct: attempt.correct_answers || 0,
              total_questions: attempt.total_questions || 0,
              total_time: attempt.time_taken_seconds || 0,
              avg_score: attempt.score || 0,
              earliest_completion: attempt.completed_at,
            })
          }
        })

        const updatedLeaderboard = Array.from(userAggregates.values())
          .sort((a, b) => {
            // Primary sort: by total points (descending)
            if (b.total_points !== a.total_points) {
              return b.total_points - a.total_points
            }
            // Secondary sort: by average score (descending)
            if (b.avg_score !== a.avg_score) {
              return b.avg_score - a.avg_score
            }
            // Tertiary sort: by earliest completion (ascending - earlier wins)
            return new Date(a.earliest_completion).getTime() - new Date(b.earliest_completion).getTime()
          })
          .map((entry, index) => ({ ...entry, rank: index + 1 }))

        setLeaderboard(updatedLeaderboard)
        setLastUpdated(new Date())
        setFlash(true)
        setTimeout(() => setFlash(false), 1000)

      } catch (error) {
        console.error('Manager leaderboard refresh failed:', error)
      }
    }

    // Listen to quiz attempt changes that affect this manager's quizzes
    const channel = supabase
      .channel('manager-leaderboard')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quiz_attempts' },
        async (payload) => {
          // Only refresh when quiz is completed
          if (payload.new?.status === 'completed' && payload.old?.status !== 'completed') {
            console.log('Quiz completed - refreshing manager leaderboard')
            // Add a small delay to ensure triggers have fired
            setTimeout(refreshLeaderboard, 500)
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_stats' },
        async () => {
          console.log('User stats changed - refreshing manager leaderboard')
          await refreshLeaderboard()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [managerId])

  const formatTime = (s: number) => {
    if (!s) return '-'
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}m ${secs}s`
  }

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
        <Card className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border border-amber-200">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-sm font-bold text-amber-800 flex items-center justify-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
              {/* 2nd Place */}
              <div className="flex flex-col items-center pt-8">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-2xl ring-4 ring-slate-300 shadow-md">🥈</div>
                <p className="font-semibold text-sm text-center truncate w-full text-slate-700 mt-2">
                  {leaderboard[1].full_name.split(' ')[0] || 'User'}
                </p>
                <p className="text-xl font-bold text-slate-600">{leaderboard[1].total_points} <span className="text-xs font-normal text-muted-foreground">pts</span></p>
              </div>
              
              {/* 1st Place */}
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-yellow-200 flex items-center justify-center text-3xl ring-4 ring-yellow-400 shadow-lg">🥇</div>
                <p className="font-bold text-center truncate w-full text-amber-800 mt-2">
                  {leaderboard[0].full_name.split(' ')[0] || 'User'}
                </p>
                <p className="text-2xl font-bold text-yellow-600">{leaderboard[0].total_points} <span className="text-xs font-normal text-muted-foreground">pts</span></p>
              </div>
              
              {/* 3rd Place */}
              <div className="flex flex-col items-center pt-12">
                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-xl ring-4 ring-amber-300 shadow-md">🥉</div>
                <p className="font-semibold text-sm text-center truncate w-full text-amber-700 mt-2">
                  {leaderboard[2].full_name.split(' ')[0] || 'User'}
                </p>
                <p className="text-lg font-bold text-amber-600">{leaderboard[2].total_points} <span className="text-xs font-normal text-muted-foreground">pts</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Rankings */}
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
              {leaderboard.map((entry, i) => (
                <div
                  key={entry.user_id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all hover:bg-muted/50 ${
                    flash && i < 3 ? 'bg-emerald-50/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-300'
                      : i === 1 ? 'bg-slate-100 text-slate-700 ring-2 ring-slate-300'
                      : i === 2 ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                      : 'bg-muted text-muted-foreground'
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{entry.full_name}</p>
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
                    <div className="text-center hidden sm:block">
                      <p className="font-semibold">{formatTime(entry.total_time)}</p>
                      <p className="text-xs text-muted-foreground">Total Time</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Data Yet</h3>
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
