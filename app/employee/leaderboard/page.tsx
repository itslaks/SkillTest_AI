import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RealtimeLeaderboard } from '@/components/employee/realtime-leaderboard'
import { Trophy } from 'lucide-react'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) redirect('/auth/login')

  let adminClient: any
  try { adminClient = createAdminClient() } catch { adminClient = supabase }

  const { data: leaderboard, error: leaderboardError } = await adminClient
    .from('user_stats')
    .select('*, profiles:user_id(full_name, email, department)')
    .order('total_points', { ascending: false })
    .limit(100)

  if (leaderboardError) {
    console.error('Leaderboard error:', leaderboardError)
  }

  console.log('Leaderboard data:', leaderboard?.length || 0, 'entries')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Top performers across all assessments</p>
      </div>

      {leaderboard && leaderboard.length > 0 ? (
        <RealtimeLeaderboard
          initialData={leaderboard}
          currentUserId={user.id}
        />
      ) : (
        <div className="rounded-2xl bg-white border border-border/60 shadow-sm p-12 text-center">
          <div className="text-muted-foreground space-y-3">
            <div className="w-16 h-16 mx-auto bg-muted/30 rounded-full flex items-center justify-center">
              <Trophy className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="text-lg font-semibold">No leaderboard data yet</h3>
            <p className="text-sm">
              Complete some quizzes to see rankings appear here!
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
