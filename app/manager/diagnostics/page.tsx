import { requireAdmin } from '@/lib/rbac'
import { getOperationalHealth, getSystemDiagnostics } from '@/lib/system-diagnostics'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, AlertTriangle, Bell, CheckCircle2, Mail, ServerCog } from 'lucide-react'

export default async function DiagnosticsPage() {
  await requireAdmin()
  const [health, checks] = await Promise.all([
    getOperationalHealth(),
    getSystemDiagnostics(),
  ])

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-900 bg-zinc-950 p-6 text-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Production Stability</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">System Diagnostics</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              Live checks for auth, email, notifications, database, scheduler, attendance automation, and AI Command operations.
            </p>
          </div>
          <Badge className={health.lastError ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}>
            {health.lastError ? 'Attention required' : 'Operational'}
          </Badge>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Mail} title="Email Status" rows={health.email} />
        <MetricCard icon={Bell} title="Reminder Status" rows={health.reminders} />
        <MetricCard icon={AlertTriangle} title="Attendance Alerts" rows={health.attendanceAlerts} />
        <Card className="border-zinc-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ServerCog className="h-4 w-4 text-blue-600" />
              SMTP Health
            </CardTitle>
            <CardDescription>{health.smtp.provider.toUpperCase()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <StatusPill ok={health.smtp.status === 'connected'} label={health.smtp.status.replaceAll('_', ' ')} />
            {health.smtp.cooldownUntil ? <p className="text-xs text-amber-700">Cooldown until {new Date(health.smtp.cooldownUntil).toLocaleString()}</p> : null}
            {health.smtp.warnings.map((warning) => <p key={warning} className="text-xs text-amber-700">{warning}</p>)}
          </CardContent>
        </Card>
      </div>

      {health.lastError ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Last Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-800">{health.lastError}</CardContent>
        </Card>
      ) : null}

      <Card className="border-zinc-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-600" />
            PASS / FAIL Checks
          </CardTitle>
          <CardDescription>These checks run server-side against current configuration and database visibility.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {checks.map((check) => (
            <div key={check.name} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-zinc-950">{check.name}</p>
                <StatusPill ok={check.status === 'PASS'} label={check.status} />
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{check.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ icon: Icon, title, rows }: { icon: any; title: string; rows: Record<string, number> }) {
  return (
    <Card className="border-zinc-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-cyan-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(rows).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-sm">
            <span className="capitalize text-zinc-600">{label}</span>
            <span className="font-semibold text-zinc-950">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
      <CheckCircle2 className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}
