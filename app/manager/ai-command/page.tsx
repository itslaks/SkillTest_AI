import { AICommandConsole, AICommandHistory } from '@/components/manager/ai-command-console'
import { requireTrainingStaff } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'

export default async function AICommandPage() {
  const auth = await requireTrainingStaff()
  const admin = createAdminClient()
  const schedulesQuery = admin
    .from('ai_command_schedules')
    .select('id, title, command_text, cadence, time_of_day, enabled, created_at')
    .order('created_at', { ascending: false })
    .limit(8)
  const [logs, schedules] = await Promise.all([
    safeTableRead(admin
      .from('ai_command_audit_logs')
      .select('id, original_prompt, detected_intent, action_type, action_status, result_summary, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(12)),
    safeTableRead(auth.role === 'admin' ? schedulesQuery : schedulesQuery.eq('created_by', auth.userId)),
  ])

  return (
    <>
      <AICommandConsole />
      <AICommandHistory logs={logs} schedules={schedules} />
    </>
  )
}

async function safeTableRead(query: PromiseLike<{ data: any[] | null; error: any }>) {
  try {
    const { data, error } = await query
    if (error) {
      console.warn('[ai-command-page] optional table read failed:', error.message)
      return []
    }
    return data || []
  } catch (error: any) {
    console.warn('[ai-command-page] optional table read failed:', error?.message || error)
    return []
  }
}
