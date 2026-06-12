import {
  assignEmployeesToTrainer,
  getAdminAuditLogs,
  getAdminUsers,
  updateUserRole,
  getPendingTrainerSignups,
  approveTrainerSignup,
  rejectTrainerSignup,
  getCertificateRulesForAdmin,
  getTrainerEmployeeAssignmentData,
  removeTrainerEmployeeAssignment,
  updateCertificateRule,
} from '@/lib/actions/manager'
import { getTrainingGovernanceSettings, updateTrainingGovernanceSettings } from '@/lib/actions/training'
import { requireManager } from '@/lib/rbac'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CertificatePreview } from '@/components/certificates/certificate-preview'
import { Clock, ShieldCheck, Trophy, Users, CheckCircle2, XCircle, UserCheck, AlertTriangle, Medal, UserCog, Link2Off } from 'lucide-react'

async function updateRoleAction(formData: FormData) {
  'use server'
  await updateUserRole(formData)
}

async function updateGovernanceAction(formData: FormData) {
  'use server'
  await updateTrainingGovernanceSettings(formData)
}

async function approveAction(formData: FormData) {
  'use server'
  await approveTrainerSignup(formData)
}

async function rejectAction(formData: FormData) {
  'use server'
  await rejectTrainerSignup(formData)
}

async function certificateRuleAction(formData: FormData) {
  'use server'
  await updateCertificateRule(formData)
}

async function trainerEmployeeAssignmentAction(formData: FormData) {
  'use server'
  await assignEmployeesToTrainer(formData)
}

async function removeTrainerEmployeeAssignmentAction(formData: FormData) {
  'use server'
  await removeTrainerEmployeeAssignment(formData)
}

export default async function AdminConsolePage() {
  // The manager layout admits all training staff (including trainers).
  // The admin console must be restricted further: managers/coordinators/admins
  // only. Mutating actions additionally verify the admin role server-side.
  await requireManager()

  const [{ data: users }, { data: auditLogs }, governance, { data: pendingTrainers }, { data: certificateQuizzes }, { data: trainerEmployeeData }] = await Promise.all([
    getAdminUsers(),
    getAdminAuditLogs(),
    getTrainingGovernanceSettings(),
    getPendingTrainerSignups(),
    getCertificateRulesForAdmin(),
    getTrainerEmployeeAssignmentData(),
  ])
  const trainerEmployeeAssignments = trainerEmployeeData?.assignments || []
  const assignmentCountsByTrainer = new Map<string, number>()
  for (const assignment of trainerEmployeeAssignments) {
    assignmentCountsByTrainer.set(assignment.trainer_id, (assignmentCountsByTrainer.get(assignment.trainer_id) || 0) + 1)
  }

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="rounded-[2rem] border border-zinc-900 bg-black p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-8 dashboard-grid-bg maverick-command-band">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30" style={{ transform: 'perspective(80px) rotateX(5deg) rotateY(-5deg)' }}>
              <ShieldCheck className="h-7 w-7 text-white drop-shadow" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center text-[9px] font-bold text-yellow-900">TMS</div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-yellow-400/80 mb-1">SkillTest_AI: Mavericks Execution Platform</p>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Admin Governance Console</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Approve trainer accounts, manage roles, configure thresholds, and review audit logs.
            </p>
          </div>
        </div>
        {pendingTrainers.length > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-sm font-semibold text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            {pendingTrainers.length} trainer sign-up{pendingTrainers.length > 1 ? 's' : ''} waiting for your approval
          </div>
        )}
      </section>

      {/* ── PENDING TRAINER SIGN-UPS ── */}
      <Card className={`border-2 shadow-md ${pendingTrainers.length > 0 ? 'border-amber-300 shadow-amber-100' : 'border-zinc-200'}`}>
        <CardHeader className={`${pendingTrainers.length > 0 ? 'bg-amber-50' : 'bg-zinc-50'} rounded-t-xl`}>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className={`h-5 w-5 ${pendingTrainers.length > 0 ? 'text-amber-600' : 'text-zinc-500'}`} />
            Pending Trainer Sign-Ups
            {pendingTrainers.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold">
                {pendingTrainers.length}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            New trainer registrations waiting for your approval. Approved trainers can log in; rejected ones cannot.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {pendingTrainers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-zinc-700">All clear!</p>
              <p className="text-sm text-zinc-500 mt-1">No pending trainer sign-up requests.</p>
            </div>
          ) : (
            pendingTrainers.map((trainer: any) => (
              <div key={trainer.id} className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-zinc-900">{trainer.full_name || 'Unnamed'}</p>
                    <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold uppercase tracking-wide">Pending</span>
                  </div>
                  <p className="text-sm text-zinc-600 mt-0.5">{trainer.email}</p>
                  {trainer.department && (
                    <p className="text-xs text-zinc-500 mt-0.5">Dept: {trainer.department}</p>
                  )}
                  <p className="text-xs text-zinc-400 mt-1">
                    Applied {new Date(trainer.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <form action={approveAction}>
                    <input type="hidden" name="user_id" value={trainer.id} />
                    <Button type="submit" size="sm" className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                  </form>
                  <form action={rejectAction}>
                    <input type="hidden" name="user_id" value={trainer.id} />
                    <Button type="submit" size="sm" variant="outline" className="rounded-full border-red-200 text-red-600 hover:bg-red-50 gap-1.5">
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ── USER ROLE MANAGEMENT + TMS CONTROLS ── */}
      <Card className="border-blue-100 bg-white shadow-sm">
        <CardHeader className="border-b border-blue-50 bg-blue-50/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCog className="h-5 w-5 text-blue-700" />
                Trainer Employee Scope
              </CardTitle>
              <CardDescription className="mt-1">
                Assign specific employees to a trainer. Trainers only see and manage employees explicitly assigned here.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-blue-200 bg-white text-blue-700">
              {trainerEmployeeAssignments.length} active link{trainerEmployeeAssignments.length === 1 ? '' : 's'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form action={trainerEmployeeAssignmentAction} className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-blue-600 p-2.5 text-white">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-zinc-950">Create or update trainer scope</p>
                <p className="mt-1 text-sm leading-5 text-zinc-600">Select one trainer and the employees they should manage.</p>
              </div>
            </div>

            {trainerEmployeeData?.warning ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {trainerEmployeeData.warning}
              </div>
            ) : null}

            <label className="mt-4 grid gap-2 text-sm">
              <span className="font-medium">Trainer</span>
              <select name="trainer_id" required className="h-11 rounded-xl border border-blue-100 bg-white px-3">
                <option value="">Select trainer</option>
                {(trainerEmployeeData?.trainers || []).map((trainer: any) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.full_name || trainer.email} ({assignmentCountsByTrainer.get(trainer.id) || 0} assigned)
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 grid gap-2 text-sm">
              <span className="font-medium">Notes</span>
              <input name="notes" className="h-11 rounded-xl border border-blue-100 bg-white px-3" placeholder="Optional cohort, domain, or ownership note" />
            </label>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Employees</p>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">{(trainerEmployeeData?.employees || []).length} available</Badge>
              </div>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {(trainerEmployeeData?.employees || []).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-center text-sm text-zinc-500">No employees are available.</p>
                ) : (trainerEmployeeData?.employees || []).map((employee: any) => (
                  <label key={employee.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/40">
                    <input type="checkbox" name="employee_ids" value={employee.id} className="mt-1 h-4 w-4 rounded border-zinc-300" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-zinc-950">{employee.full_name || employee.email}</span>
                      <span className="block truncate text-xs text-zinc-500">{employee.email}</span>
                      <span className="mt-1 block text-xs text-zinc-400">{employee.employee_id || 'No ID'} - {employee.domain || employee.department || 'No domain'}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Button type="submit" className="mt-4 rounded-full bg-blue-700 text-white hover:bg-blue-800">
              Save trainer scope
            </Button>
          </form>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-zinc-950">Active trainer-employee links</p>
                <p className="mt-1 text-sm text-zinc-500">Remove a link when an employee should no longer be managed by that trainer.</p>
              </div>
              <Badge variant="outline" className="bg-white">{trainerEmployeeAssignments.length} links</Badge>
            </div>

            <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              {trainerEmployeeAssignments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
                  <UserCheck className="mx-auto h-9 w-9 text-zinc-400" />
                  <p className="mt-3 font-semibold text-zinc-700">No scoped trainer assignments yet</p>
                  <p className="mt-1 text-sm text-zinc-500">Create the first trainer-employee mapping using the form.</p>
                </div>
              ) : trainerEmployeeAssignments.map((assignment: any) => (
                <div key={assignment.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Trainer</p>
                      <p className="truncate font-semibold text-zinc-950">{assignment.trainer?.full_name || assignment.trainer?.email || 'Trainer'}</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Employee</p>
                      <p className="truncate font-medium text-zinc-800">{assignment.employee?.full_name || assignment.employee?.email || 'Employee'}</p>
                      <p className="truncate text-xs text-zinc-500">{assignment.employee?.email} - {assignment.employee?.employee_id || 'No ID'}</p>
                      {assignment.notes ? <p className="mt-2 text-xs text-zinc-500">Note: {assignment.notes}</p> : null}
                      <p className="mt-2 text-xs text-zinc-400">Assigned {new Date(assignment.assigned_at).toLocaleDateString('en-IN')}</p>
                    </div>
                    <form action={removeTrainerEmployeeAssignmentAction}>
                      <input type="hidden" name="assignment_id" value={assignment.id} />
                      <Button type="submit" size="sm" variant="outline" className="rounded-full border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
                        <Link2Off className="mr-1.5 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] 2xl:grid-cols-[minmax(0,1.35fr)_minmax(26rem,0.65fr)]">
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Role Management
            </CardTitle>
            <CardDescription>
              Promote staff into Trainer, Training Coordinator, Manager, or Admin roles. Employee accounts are managed via the import system.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">No staff users found.</p>
            ) : users.map((user: any) => (
              <form key={user.id} action={updateRoleAction} className="grid gap-3 rounded-2xl border border-zinc-200 p-4 md:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
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
            <CardDescription>
              These values drive cut-off alerts, feedback windows, and reproducible topper calculations.
            </CardDescription>
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

      <Card className="border-zinc-200 bg-white shadow-sm">
        <CardHeader className="border-b border-zinc-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Medal className="h-5 w-5 text-amber-600" />
                Certificate Automation
              </CardTitle>
              <CardDescription className="mt-1">
                Compact controls for certificate eligibility, naming, template, and preview.
              </CardDescription>
            </div>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
              {(certificateQuizzes || []).length} quiz rules
            </span>
          </div>
        </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-2">
          {(certificateQuizzes || []).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500">No quizzes available for certificate rules.</p>
          ) : (certificateQuizzes || []).slice(0, 20).map((quiz: any) => (
            <form key={quiz.id} action={certificateRuleAction} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-3">
              <input type="hidden" name="quiz_id" value={quiz.id} />
              <input type="hidden" name="existing_template_image_url" value={quiz.certificate_rule?.template_image_url || ''} />
              <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_9rem_8rem_auto] xl:grid-cols-[minmax(0,1fr)_7.5rem_6.5rem_auto] 2xl:grid-cols-[minmax(0,1fr)_9rem_8rem_auto]">
                <label className="flex min-w-0 items-start gap-3">
                  <input
                    name="enabled"
                    type="checkbox"
                    defaultChecked={quiz.certificate_rule?.enabled || false}
                    className="mt-1 h-4 w-4 rounded border-zinc-300"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-zinc-950" title={quiz.title}>{quiz.title}</span>
                    <span className="text-xs text-zinc-500">{quiz.topic} - {quiz.difficulty}</span>
                    <span className="mt-1 block text-xs font-semibold text-amber-700">
                      {quiz.certificate_rule?.enabled ? `Active at ${quiz.certificate_rule?.min_score || 70}%` : 'Disabled'}
                    </span>
                  </span>
                </label>
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  Minimum score
                  <input name="min_score" type="number" min="0" max="100" defaultValue={quiz.certificate_rule?.min_score || 90} className="h-10 rounded-xl border border-zinc-200 bg-white px-3" />
                </label>
                <label className="grid gap-1 text-xs font-medium text-zinc-600">
                  Accent
                  <input name="template_accent_color" type="color" defaultValue={quiz.certificate_rule?.template_accent_color || '#d97706'} className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-2" />
                </label>
                <Button type="submit" className="h-10 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800">Save rule</Button>
              </div>
              <details className="mt-3 rounded-xl border border-zinc-200 bg-white p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Advanced certificate content and preview</summary>
                <div className="mt-3 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="grid gap-1 text-xs font-medium text-zinc-600">
                      Certificate name shown to employee
                      <input name="certificate_name" defaultValue={quiz.certificate_rule?.certificate_name || `${quiz.topic} Course Completion`} className="h-10 rounded-xl border border-zinc-200 px-3" />
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-zinc-600">
                      Certificate title / heading
                      <input name="title" defaultValue={quiz.certificate_rule?.title || `Certificate of Achievement - ${quiz.topic}`} className="h-10 rounded-xl border border-zinc-200 px-3" />
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-zinc-600 md:col-span-2">
                      Message
                      <input name="message" defaultValue={quiz.certificate_rule?.message || 'Awarded for successful course completion.'} className="h-10 rounded-xl border border-zinc-200 px-3" />
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-zinc-600">
                      Upload certificate format
                      <input name="template_file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="rounded-xl border border-zinc-200 px-3 py-2 text-xs" />
                      {quiz.certificate_rule?.template_image_url && <span className="text-[10px] text-emerald-700">Template uploaded. New upload replaces it.</span>}
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-zinc-600">
                      Template notes
                      <input name="template_notes" defaultValue={quiz.certificate_rule?.template_notes || 'Employee name, course name, score, and issue date are rendered automatically.'} className="h-10 rounded-xl border border-zinc-200 px-3" />
                    </label>
                  </div>
                  <CertificatePreview
                    compact
                    employeeName="Laksham S J"
                    topic={quiz.topic || quiz.title}
                    certificateTitle={quiz.certificate_rule?.certificate_name || `${quiz.topic || quiz.title} Completion`}
                    message={quiz.certificate_rule?.message || `has completed ${quiz.topic || quiz.title} and demonstrated the required proficiency for this credential.`}
                    issueDate={new Date().toLocaleDateString('en-IN')}
                    score={quiz.certificate_rule?.min_score || 90}
                    employeeId="EMP1024"
                    templateImageUrl={quiz.certificate_rule?.template_image_url || null}
                    accent={quiz.certificate_rule?.template_accent_color || '#6f5ab8'}
                  />
                </div>
              </details>
            </form>
          ))}
        </CardContent>
      </Card>

      {/* ── AUDIT LOG ── */}
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
