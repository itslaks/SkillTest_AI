import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Medal, Flame, Star, Crown } from 'lucide-react'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Use admin client to bypass RLS for leaderboard data
  const adminClient = createAdminClient()

  // Get global leaderboard from user_stats
  const { data: leaderboard } = await adminClient
    .from('user_stats')
    .select('*, profiles:user_id(full_name, email, avatar_url, department, employee_id)')
    .order('total_points', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Crown className="h-8 w-8 text-yellow-500" />
          Leaderboard
        </h1>
        <p className="text-muted-foreground">Top performers across all assessments</p>
      </div>

      {/* Top 3 podium */}
      {leaderboard && leaderboard.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {/* 2nd place */}
          <div className="flex flex-col items-center pt-8">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl mb-2">🥈</div>
            <p className="font-medium text-sm text-center truncate w-full">{(leaderboard[1] as any).profiles?.full_name || 'User'}</p>
            <p className="text-2xl font-bold text-gray-600">{leaderboard[1].total_points}</p>
            <p className="text-xs text-muted-foreground">points</p>
          </div>

          {/* 1st place */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center text-3xl mb-2 ring-4 ring-yellow-300">🥇</div>
            <p className="font-semibold text-center truncate w-full">{(leaderboard[0] as any).profiles?.full_name || 'User'}</p>
            <p className="text-3xl font-bold text-yellow-600">{leaderboard[0].total_points}</p>
            <p className="text-xs text-muted-foreground">points</p>
          </div>

          {/* 3rd place */}
          <div className="flex flex-col items-center pt-12">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-xl mb-2">🥉</div>
            <p className="font-medium text-sm text-center truncate w-full">{(leaderboard[2] as any).profiles?.full_name || 'User'}</p>
            <p className="text-xl font-bold text-amber-600">{leaderboard[2].total_points}</p>
            <p className="text-xs text-muted-foreground">points</p>
          </div>
        </div>
      )}

      {/* Full leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>All Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leaderboard?.map((entry: any, i: number) => (
              <div
                key={entry.user_id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  entry.user_id === user?.id ? 'bg-primary/5 border-primary/30' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700'
                    : i === 1 ? 'bg-gray-100 text-gray-700'
                    : i === 2 ? 'bg-amber-100 text-amber-700'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {entry.profiles?.full_name || 'Unknown'}
                      {entry.user_id === user?.id && (
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">You</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{entry.profiles?.department || ''}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="font-semibold">{entry.total_points}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-muted-foreground">
                    <Flame className="h-4 w-4 text-orange-500" />
                    {entry.current_streak}
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-muted-foreground">
                    <Trophy className="h-4 w-4 text-blue-500" />
                    {entry.tests_completed}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
