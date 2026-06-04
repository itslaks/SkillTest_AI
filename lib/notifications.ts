type AdminClient = ReturnType<typeof import('@/lib/supabase/server').createAdminClient>

export type StaffNotification = {
  id: string
  title: string
  message: string
  audience: string | null
  channel: string | null
  delivery_status: string | null
  created_at: string
  sent_at?: string | null
  scheduled_for?: string | null
  batch?: { id: string; title: string; domain?: string | null } | null
  session?: { id: string; title: string; session_date?: string | null } | null
  recipient?: { id: string; full_name?: string | null; email?: string | null } | null
  creator?: { id: string; full_name?: string | null; email?: string | null; role?: string | null } | null
}

export async function getStaffNotifications(
  admin: AdminClient,
  userId: string,
  role: string,
  limit = 40,
): Promise<StaffNotification[]> {
  if (role === 'admin') {
    const { data } = await baseNotificationQuery(admin)
      .order('created_at', { ascending: false })
      .limit(limit)
    return normalizeNotifications(data || [])
  }

  const batchIds = await getTrainerBatchIds(admin, userId)
  const queries = [
    baseNotificationQuery(admin).eq('created_by', userId).limit(limit),
    baseNotificationQuery(admin).eq('recipient_user_id', userId).limit(limit),
  ]

  if (batchIds.length > 0) {
    queries.push(baseNotificationQuery(admin).in('batch_id', batchIds).limit(limit))
  }

  const results = await Promise.all(queries)
  const byId = new Map<string, StaffNotification>()
  for (const result of results) {
    for (const notification of result.data || []) {
      const normalized = normalizeNotification(notification)
      byId.set(normalized.id, normalized)
    }
  }

  return [...byId.values()]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, limit)
}

export function getNotificationVerb(notification: Pick<StaffNotification, 'title' | 'message' | 'delivery_status'>) {
  const text = `${notification.title} ${notification.message} ${notification.delivery_status || ''}`.toLowerCase()
  if (text.includes('assigned') || text.includes('assignment')) return 'Assigned'
  if (text.includes('created') || text.includes('new ')) return 'Created'
  if (text.includes('executed') || text.includes('automation') || text.includes('run')) return 'Executed'
  if (text.includes('completed') || text.includes('uploaded') || text.includes('processed')) return 'Implemented'
  if (text.includes('sent') || text.includes('queued')) return 'Sent'
  return 'Logged'
}

function normalizeNotifications(rows: any[]): StaffNotification[] {
  return rows.map(normalizeNotification)
}

function normalizeNotification(row: any): StaffNotification {
  return {
    ...row,
    batch: firstRelation(row.batch),
    session: firstRelation(row.session),
    recipient: firstRelation(row.recipient),
    creator: firstRelation(row.creator),
  } as StaffNotification
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function baseNotificationQuery(admin: AdminClient) {
  return admin
    .from('training_notifications')
    .select(`
      id,
      title,
      message,
      audience,
      channel,
      delivery_status,
      scheduled_for,
      sent_at,
      created_at,
      batch:batch_id(id,title,domain),
      session:session_id(id,title,session_date),
      recipient:recipient_user_id(id,full_name,email),
      creator:created_by(id,full_name,email,role)
    `)
}

async function getTrainerBatchIds(admin: AdminClient, userId: string) {
  const [primary, assigned] = await Promise.all([
    admin.from('training_batches').select('id').eq('trainer_id', userId),
    admin.from('training_batch_trainers').select('batch_id').eq('trainer_id', userId),
  ])

  return [
    ...new Set([
      ...(primary.data || []).map((batch: any) => batch.id as string),
      ...(assigned.data || []).map((assignment: any) => assignment.batch_id as string),
    ]),
  ]
}
