import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RealtimeLeaderboard } from '@/components/employee/realtime-leaderboard'

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

  if (leaderboardError) console.error('Leaderboard error:', leaderboardError)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Top performers across all assessments</p>
      </div>

      <RealtimeLeaderboard
        initialData={leaderboard || []}
        currentUserId={user.id}
      />
    </div>
  )
}
