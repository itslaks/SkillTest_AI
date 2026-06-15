import { NextResponse } from 'next/server'
import { requireTrainingStaffForApi } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await requireTrainingStaffForApi()
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()
  const query = admin
    .from('ai_command_schedules')
    .select('id, title, command_text, cadence, day_of_week, day_of_month, time_of_day, timezone, enabled, last_run_at, next_run_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  const { data, error } = await (auth.role === 'admin' ? query : query.eq('created_by', auth.userId))
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ schedules: data || [] })
}
