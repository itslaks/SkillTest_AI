import { Badge } from '@/components/ui/badge'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/rbac'
import { getNotificationVerb, getStaffNotifications, type StaffNotification } from '@/lib/notifications'
import { Bell, CheckCircle2, ClipboardList, Mail, Radio, UserRound } from 'lucide-react'

export default async function ManagerNotificationsPage() {
  const { userId, role } = await requireRole('admin', 'trainer')
  const admin = createAdminClient()
  const notifications = await getStaffNotifications(admin, userId, role, 80)

  const stats = {
    total: notifications.length,
    sent: notifications.filter((item) => item.delivery_status === 'sent').length,
    queued: notifications.filter((item) => ['queued', 'scheduled'].includes(item.delivery_status || '')).length,
    logged: notifications.filter((item) => ['logged', 'draft'].includes(item.delivery_status || '')).length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Activity Log</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            A compact record of training actions such as created, assigned, executed, implemented, queued, and sent events.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Total" value={stats.total} />
          <Metric label="Sent" value={stats.sent} />
          <Metric label="Queued" value={stats.queued} />
          <Metric label="Logged" value={stats.logged} />
        </div>
      </div>

      <section className="rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <p className="text-sm font-semibold text-zinc-950">Recent events</p>
          <p className="text-xs text-zinc-500">Newest notification records appear first.</p>
        </div>
        <div className="divide-y divide-zinc-100">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">No notification events are available yet.</div>
          ) : notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </div>
      </section>
    </div>
  )
}

function NotificationRow({ notification }: { notification: StaffNotification }) {
  const verb = getNotificationVerb(notification)
  const context = notification.batch?.title || notification.session?.title || notification.recipient?.full_name || 'General activity'

  return (
    <article className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={verbClassName(verb)}>{verb}</Badge>
          <Badge variant="outline" className="capitalize">{notification.delivery_status || 'logged'}</Badge>
          <span className="text-xs text-zinc-400">{new Date(notification.created_at).toLocaleString()}</span>
        </div>
        <h2 className="mt-2 truncate text-base font-semibold text-zinc-950">{notification.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-600">{notification.message}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
          <LogPill icon={ClipboardList} text={context} />
          <LogPill icon={UserRound} text={notification.creator?.full_name || notification.creator?.email || 'System'} />
          <LogPill icon={Mail} text={notification.channel || 'in_app'} />
        </div>
      </div>
      <div className="flex items-center gap-2 md:justify-end">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-white">
          {verb === 'Sent' ? <Mail className="h-4 w-4" /> : verb === 'Executed' ? <Radio className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        </div>
      </div>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-950">{value}</p>
    </div>
  )
}

function LogPill({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{text}</span>
    </span>
  )
}

function verbClassName(verb: string) {
  if (verb === 'Assigned') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (verb === 'Created') return 'border-violet-200 bg-violet-50 text-violet-700'
  if (verb === 'Executed') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (verb === 'Implemented') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (verb === 'Sent') return 'border-cyan-200 bg-cyan-50 text-cyan-700'
  return 'border-zinc-200 bg-zinc-50 text-zinc-700'
}
