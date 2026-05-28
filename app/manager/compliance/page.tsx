import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FolderOpen,
  RadioTower,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireManager } from '@/lib/rbac'
import { getTrainingOpsManagerData } from '@/lib/actions/training'

type CoverageStatus = 'Exceeds' | 'Covered' | 'Needs data'

type RequirementItem = {
  ref: string
  title: string
  status: CoverageStatus
  icon: any
  proof: string
  evidence: string[]
  href: string
}

const statusClass: Record<CoverageStatus, string> = {
  Exceeds: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Covered: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  'Needs data': 'border-amber-200 bg-amber-50 text-amber-800',
}

export default async function CompliancePage() {
  await requireManager()
  const data = await getTrainingOpsManagerData()

  const activeBatches = data.batches.filter((batch: any) => ['running', 'active'].includes(batch.status)).length
  const closedBatches = data.batches.filter((batch: any) => ['completed', 'closed'].includes(batch.status)).length
  const assessmentDocuments = data.assessmentSetups.filter((setup: any) => setup.question_file_name).length
  const projectEvidence = data.projectEvaluations.filter((item: any) => item.evidence_file_name).length
  const auditEvents =
    data.attendanceVersions.length +
    data.assessmentUploads.length +
    data.batchChangeAudit.length +
    data.notificationDispatchLogs.length +
    data.automationRuns.length
  const trainerLinks = data.batchTrainers.length + data.batches.filter((batch: any) => batch.trainer_id).length
  const feedbackCoverage = data.feedback.length
  const notificationCoverage = data.notifications.length + data.notificationDispatchLogs.length
  const hasComparison = data.batches.length >= 2

  const requirements: RequirementItem[] = [
    {
      ref: '5.1',
      title: 'Training Batch Management',
      status: data.batches.length ? 'Covered' : 'Needs data',
      icon: CalendarDays,
      proof: `${data.batches.length} batch record(s), ${activeBatches} active/running, ${closedBatches} completed/closed.`,
      evidence: ['Unique batch IDs', 'lifecycle statuses', 'trainer assignments', 'candidate import and status grid'],
      href: '/manager/operations',
    },
    {
      ref: '5.2',
      title: 'Attendance Tracker',
      status: data.attendanceVersions.length ? 'Exceeds' : data.attendance.length ? 'Covered' : 'Needs data',
      icon: ClipboardCheck,
      proof: `${data.attendance.length} attendance mark(s), ${data.attendanceVersions.length} version/audit row(s).`,
      evidence: ['manual entry', 'Excel importer', 'row-level validation feedback', 'cut-off and absence automation'],
      href: '/manager/operations#attendance',
    },
    {
      ref: '5.3',
      title: 'Assessment Score Tracker',
      status: data.assessmentUploads.length || data.assessmentSetups.length ? 'Covered' : 'Needs data',
      icon: FileSpreadsheet,
      proof: `${data.assessmentSetups.length} assessment setup(s), ${data.assessmentUploads.length} scored upload audit row(s).`,
      evidence: ['Excel score import', 'template metadata', 'passing thresholds', 'project evaluation scores'],
      href: '/manager/operations#assessment',
    },
    {
      ref: '5.4',
      title: 'Notifications & Alerts',
      status: notificationCoverage ? 'Covered' : 'Needs data',
      icon: RadioTower,
      proof: `${data.notifications.length} notification(s), ${data.notificationDispatchLogs.length} recipient dispatch log(s).`,
      evidence: ['attendance cut-off', 'absence streak', 'assessment reminders', 'feedback reminders', 'provider status logs'],
      href: '/manager/operations#feedback',
    },
    {
      ref: '5.5',
      title: 'Feedback Management',
      status: feedbackCoverage ? 'Exceeds' : 'Covered',
      icon: Users,
      proof: `${data.feedback.length} feedback response(s) with sentiment, content, and trainer effectiveness analytics.`,
      evidence: ['batch feedback requests', 'sentiment chart', 'standalone feedback PDF', 'batch feedback exports'],
      href: '/manager/reports',
    },
    {
      ref: '5.6',
      title: 'Dashboards & Metrics',
      status: hasComparison && trainerLinks ? 'Exceeds' : 'Covered',
      icon: BarChart3,
      proof: `${data.batches.length} batch(es) feed the comparison deck; ${trainerLinks} trainer-batch link(s) feed scorecards.`,
      evidence: ['batch comparison radar', 'trainer impact scorecards', 'assessment clearance', 'near real-time summary KPIs'],
      href: '/manager/operations',
    },
    {
      ref: '5.7',
      title: 'Reports & Downloads',
      status: 'Covered',
      icon: FileCheck2,
      proof: 'Excel and PDF export routes are available for batch, attendance, assessment, feedback, topper, and consolidated reports.',
      evidence: ['operations workbook', 'batch assessment export', 'batch feedback export', 'PDF export variants'],
      href: '/manager/reports',
    },
    {
      ref: '5.8',
      title: 'Topper Identification',
      status: 'Covered',
      icon: Trophy,
      proof: `Governance settings apply configurable weights and thresholds for topper ranking.`,
      evidence: ['overall assessment score', 'project evaluation score', 'configurable weights', 'transparent leaderboard'],
      href: '/manager/reports',
    },
    {
      ref: '6.1',
      title: 'Security & RBAC',
      status: 'Covered',
      icon: ShieldCheck,
      proof: 'Manager, admin, trainer, and employee access is enforced through route guards and scoped training queries.',
      evidence: ['trainer assigned-batch scope', 'manager/admin governance access', 'protected evidence file route'],
      href: '/manager/admin',
    },
    {
      ref: '6.2 / 6.4',
      title: 'Performance, Audit & Logging',
      status: auditEvents ? 'Exceeds' : 'Covered',
      icon: FolderOpen,
      proof: `${auditEvents} audit/log row(s) across uploads, attendance versions, notifications, automation, and batch changes.`,
      evidence: ['chunked Excel import', 'upload logs', 'attendance versioning', 'notification dispatch evidence', 'automation runs'],
      href: '/manager/operations',
    },
  ]

  const completeCount = requirements.filter((item) => item.status !== 'Needs data').length
  const readiness = Math.round((completeCount / requirements.length) * 100)
  const differentiators = [
    'Batch DNA comparison radar for side-by-side program scoring',
    'Trainer impact scorecards across attendance, assessment, and feedback',
    'Evidence vault for question files and project proof uploads',
    'Governance automation runbook with notification audit trails',
    'This live BRD proof page for judge walkthroughs',
  ]

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-zinc-900 bg-black text-white shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-100">
              BRD Proof Matrix
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-5xl">SkillTest_AI: Mavericks Execution Platform compliance cockpit</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
              A live, judge-ready map from BRD requirements to working screens, exports, automation logs, and evidence records.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="rounded-full bg-white text-black hover:bg-zinc-200">
                <Link href="/manager/operations">
                  Open operations
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Link href="/manager/reports">View reports</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full border-cyan-300/30 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/15">
                <a href="/api/reports/training-ops/download">
                  Evidence pack
                  <Download className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ProofMetric label="BRD readiness" value={`${readiness}%`} detail={`${completeCount}/${requirements.length} requirement groups covered`} />
            <ProofMetric label="Evidence files" value={`${assessmentDocuments + projectEvidence}`} detail="question files and project evidence uploads" />
            <ProofMetric label="Audit trail" value={`${auditEvents}`} detail="upload, notification, automation, and change events" />
            <ProofMetric label="Contest edge" value={`${differentiators.length}`} detail="visible features beyond the baseline BRD" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Requirement Coverage</CardTitle>
            <CardDescription>What is present, what is evidenced, and where judges can verify it in the product.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {requirements.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.ref}
                  href={item.href}
                  className="group grid gap-4 rounded-[1.35rem] border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm md:grid-cols-[4.5rem_1fr_auto]"
                >
                  <div className="flex items-center gap-3 md:block">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-mono text-xs font-semibold text-zinc-500 md:mt-2">{item.ref}</p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-zinc-950">{item.title}</h2>
                      <Badge variant="outline" className={statusClass[item.status]}>{item.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.proof}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.evidence.map((evidence) => (
                        <span key={evidence} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600">
                          {evidence}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center text-sm font-semibold text-zinc-500 group-hover:text-zinc-950">
                    Verify
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden border-zinc-900 bg-black text-white shadow-sm">
            <CardHeader>
              <CardTitle>What Makes It Stand Out</CardTitle>
              <CardDescription className="text-zinc-400">The parts that go beyond the BRD and create the demo story.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {differentiators.map((item, index) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-black">{index + 1}</div>
                    <p className="text-sm leading-relaxed text-zinc-200">{item}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>Demo Data Checklist</CardTitle>
              <CardDescription>Complete these before judging to make every BRD proof tile glow with live evidence.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-600">
              <GapNote ready={data.batches.length >= 2} text="Add at least two populated batches to make the comparison radar impressive." />
              <GapNote ready={assessmentDocuments + projectEvidence > 0} text="Upload real assessment/question and evidence files so the evidence vault has judge-visible artifacts." />
              <GapNote ready={feedbackCoverage > 0} text="Collect feedback responses to light up sentiment and trainer effectiveness analytics." />
              <GapNote ready={notificationCoverage > 0} text="Run the governance automation checks once to create notification dispatch proof." />
            </CardContent>
          </Card>

          <Card className="border-cyan-200 bg-cyan-50/70 shadow-sm">
            <CardHeader>
              <CardTitle>One-Click Evidence Pack</CardTitle>
              <CardDescription>The workbook includes BRD coverage, batch data, upload logs, notifications, automation, feedback, toppers, and a demo runbook.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button asChild className="rounded-full bg-black text-white hover:bg-zinc-800">
                <a href="/api/reports/training-ops/download">Download Excel evidence pack</a>
              </Button>
              <Button asChild variant="outline" className="rounded-full bg-white">
                <a href="/api/reports/training-ops/pdf">Download executive PDF</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

function ProofMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{detail}</p>
    </div>
  )
}

function GapNote({ ready, text }: { ready: boolean; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${ready ? 'text-emerald-600' : 'text-amber-600'}`} />
      <p>{text}</p>
    </div>
  )
}
