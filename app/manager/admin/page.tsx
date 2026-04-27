import { getAdminAuditLogs, getAdminUsers, updateUserRole } from '@/lib/actions/manager'
import { getTrainingGovernanceSettings, updateTrainingGovernanceSettings } from '@/lib/actions/training'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, ShieldCheck, Trophy, Users } from 'lucide-react'

async function updateRoleAction(formData: FormData) {
  'use server'
  await updateUserRole(formData)
}

async function updateGovernanceAction(formData: FormData) {
  'use server'
  await updateTrainingGovernanceSettings(formData)
}

export default async function AdminConsolePage() {
  const [{ data: users }, { data: auditLogs }, governance] = await Promise.all([
    getAdminUsers(),
    getAdminAuditLogs(),
    getTrainingGovernanceSettings(),
  ])

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-zinc-900 bg-black p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-8 dashboard-grid-bg">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">Maverick TMS</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Admin governance console</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Manage roles, operational thresholds, topper criteria, and audit-sensitive controls from one place.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Role Management
            </CardTitle>
            <CardDescription>Add users through employee import, then promote staff into Trainer, Training Coordinator, Manager, or Admin roles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">No staff users found.</p>
            ) : users.map((user: any) => (
              <form key={user.id} action={updateRoleAction} className="grid gap-3 rounded-2xl border border-zinc-200 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                <input type="hidden" name="user_id" value={user.id} />
                <div className="min-w-0">
                  <p className="font-medium">{user.full_name || user.email}</p>
                  <p className="truncate text-sm text-zinc-500">{user.email}</p>
                </div>
                <Badge variant="outline" className="w-fit capitalize">{user.role.replace('_', ' ')}</Badge>
                <div className="flex flex-wrap gap-2">
                  <select name="role" defaultValue={user.role} className="h-10 rounded-xl border border-zinc-200 px-3 text-sm">
                    <option value="trainer">Trainer</option>
                    <option value="training_coordinator">Training Coordinator</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="employee">Candidate</option>
                  </select>
                  <Button type="submit" size="sm" className="rounded-full bg-black text-white hover:bg-zinc-800">Save</Button>
                </div>
              </form>
            ))}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              TMS Controls
            </CardTitle>
            <CardDescription>These values drive cut-off alerts, feedback windows, and reproducible topper calculations.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateGovernanceAction} className="space-y-4">
              <label className="grid gap-2 text-sm">
                <span className="flex items-center gap-2 font-medium"><Clock className="h-4 w-4" />Attendance cut-off</span>
                <input name="attendance_cutoff_time" type="time" defaultValue={governance.attendanceCutoffTime} className="h-11 rounded-xl border border-zinc-200 px-3" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Absence alert days</span>
                <input name="absence_alert_days" type="number" min="1" max="10" defaultValue={governance.absenceAlertDays} className="h-11 rounded-xl border border-zinc-200 px-3" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Default feedback window</span>
                <input name="feedback_window_days" type="number" min="1" max="30" defaultValue={governance.feedbackWindowDays} className="h-11 rounded-xl border border-zinc-200 px-3" />
              </label>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">Topper Criteria</p>
                <div className="mt-3 grid gap-3">
                  <input name="topper_assessment_weight" type="number" min="0" max="100" defaultValue={governance.topperAssessmentWeight} className="h-11 rounded-xl border border-amber-200 bg-white px-3" aria-label="Assessment weight" />
                  <input name="topper_project_weight" type="number" min="0" max="100" defaultValue={governance.topperProjectWeight} className="h-11 rounded-xl border border-amber-200 bg-white px-3" aria-label="Project weight" />
                  <input name="topper_min_attendance" type="number" min="0" max="100" defaultValue={governance.topperMinAttendance} className="h-11 rounded-xl border border-amber-200 bg-white px-3" aria-label="Minimum attendance" />
                </div>
              </div>
              <Button type="submit" className="rounded-full bg-black text-white hover:bg-zinc-800">Save controls</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-200 shadow-sm">
        <CardHeader>
          <CardTitle>Admin Audit Log</CardTitle>
          <CardDescription>Role and governance-sensitive changes are retained for review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditLogs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">No admin audit entries yet.</p>
          ) : auditLogs.map((entry: any) => (
            <div key={entry.id} className="rounded-2xl border border-zinc-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">{entry.action.replaceAll('_', ' ')}</p>
                <Badge variant="outline">{entry.target_table || 'system'}</Badge>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {entry.actor?.full_name || entry.actor?.email || 'System'} - {new Date(entry.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
