import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/rbac'
import { getQuizStats, getQuizzes } from '@/lib/actions/quiz'
import { getEmployees } from '@/lib/actions/manager'
import { getTrainingGovernanceSettings } from '@/lib/actions/training'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  Users,
  FileQuestion,
  Trophy,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Target,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import { DownloadReportButton } from '@/components/manager/download-report-button'
import { QuickDeleteButton } from '@/components/manager/quick-delete-button'
import { TmsBatchDownloads } from '@/components/manager/tms-batch-downloads'
import { OpsAutoRefresh } from '@/components/manager/ops-auto-refresh'
import { TrainerPerformancePanel } from '@/components/manager/trainer-performance-panel'
import { AiInsightCard } from '@/components/manager/ai-insight-card'
import { averageScore, computeTopperScore } from '@/lib/topper'
import { getAccessibleTrainingBatchIds } from '@/lib/training-access'

export default async function ManagerReportsPage() {
  const { userId, role } = await requireManager()

  const supabase = await createClient()
  const admin = createAdminClient()

  const [statsRes, quizzesRes, employeesRes, governance] = await Promise.all([
    getQuizStats(),
    getQuizzes(),
    getEmployees(),
    getTrainingGovernanceSettings(),
  ])

  const stats = statsRes.data || { totalQuizzes: 0, totalAttempts: 0, averageScore: 0, uniqueEmployees: 0 }
  const quizzes = quizzesRes.data || []
  const employees = employeesRes.data || []

  const accessibleBatchIds = await getAccessibleTrainingBatchIds(userId, role)
  const { data: batches } = accessibleBatchIds.length
    ? await admin
        .from('training_batches')
        .select('id, title, status, trainer:trainer_id(id, full_name, email)')
        .in('id', accessibleBatchIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const batchIds = (batches || []).map((batch: any) => batch.id)
  const [membersRes, attendanceRes, projectRes, attemptsRes, feedbackRes, batchTrainersRes, importResultsRes, assessmentSetupsRes] = await Promise.all([
    batchIds.length
      ? admin
          .from('batch_members')
          .select('*, profile:user_id(full_name, email, employee_id)')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('session_attendance')
          .select('user_id, status, session:session_id(batch_id)')
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_project_evaluations')
          .select('batch_id, user_id, score')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('quiz_attempts')
          .select('user_id, score, quizzes!inner(batch_id)')
          .in('quizzes.batch_id', batchIds)
          .eq('status', 'completed')
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_feedback')
          .select('trainer_effectiveness_rating, batch_id')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_batch_trainers')
          .select('batch_id, trainer:trainer_id(id, full_name, email)')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('assessment_results')
          .select('batch_id, assessment_setup_id, percentage, candidate_score')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
    batchIds.length
      ? admin
          .from('training_assessment_setups')
          .select('id, batch_id, title, assessment_type, passing_score')
          .in('batch_id', batchIds)
      : Promise.resolve({ data: [] }),
  ])

  const members = membersRes.data || []
  const trainingAttendance = attendanceRes.data || []
  const projectEvaluations = projectRes.data || []
  const trainingAttempts = attemptsRes.data || []
  const trainingFeedback = feedbackRes.data || []
  const batchTrainersList = batchTrainersRes.data || []
  const importedAssessments = importResultsRes.data || []
  const assessmentSetups = assessmentSetupsRes.data || []
  const statusCounts = {
    discontinued: members.filter((member: any) => ['discontinued', 'dropped'].includes(member.enrollment_status)).length,
    notCleared: members.filter((member: any) => member.enrollment_status === 'not_cleared').length,
    offered: members.filter((member: any) => member.enrollment_status === 'offered').length,
    onboarded: members.filter((member: any) => ['onboarded', 'active'].includes(member.enrollment_status)).length,
  }

  const topperRows = buildTopperRows(members, trainingAttempts, projectEvaluations, trainingAttendance, importedAssessments, governance).slice(0, 10)
  const trainerMetrics = buildTrainerMetrics(batches || [], batchTrainersList, trainingAttendance, trainingAttempts, trainingFeedback, projectEvaluations, importedAssessments)
  const assessmentClearanceRows = buildAssessmentClearanceRows(batches || [], importedAssessments, assessmentSetups)

  // Get per-quiz attempt data
  const quizIds = quizzes.map((q: any) => q.id)
  let quizAttemptData: Record<string, { attempts: number; avgScore: number; passRate: number }> = {}

  if (quizIds.length > 0) {
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('quiz_id, score, completed_at')
      .in('quiz_id', quizIds)
      .not('completed_at', 'is', null)

    if (attempts) {
      for (const attempt of attempts) {
        if (!quizAttemptData[attempt.quiz_id]) {
          quizAttemptData[attempt.quiz_id] = { attempts: 0, avgScore: 0, passRate: 0 }
        }
        quizAttemptData[attempt.quiz_id].attempts++
        quizAttemptData[attempt.quiz_id].avgScore += attempt.score
      }

      // Calculate averages and pass rates
      for (const qid of Object.keys(quizAttemptData)) {
        const quiz = quizzes.find((q: any) => q.id === qid)
        const passingScore = quiz?.passing_score || 70
        quizAttemptData[qid].avgScore = Math.round(quizAttemptData[qid].avgScore / quizAttemptData[qid].attempts)

        const passCount = attempts.filter((a: any) => a.quiz_id === qid && a.score >= passingScore).length
        quizAttemptData[qid].passRate = Math.round((passCount / quizAttemptData[qid].attempts) * 100)
      }
    }
  }

  // Domain breakdown
  const domainCounts: Record<string, number> = {}
  for (const emp of employees) {
    const domain = (emp as any).domain || 'Uncategorized'
    domainCounts[domain] = (domainCounts[domain] || 0) + 1
  }

  return (
    <div className="space-y-8">
      <OpsAutoRefresh intervalMs={45000} compact />
      <section className="rounded-[2rem] border border-zinc-900 bg-black p-6 text-white shadow-[0_32px_90px_rgba(0,0,0,0.42)] md:p-8 dashboard-grid-bg maverick-command-band">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-300/80">Maverick TMS Evidence Desk</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Reports that prove execution, not just export data</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">Attendance, assessment, feedback, topper, automation, and consolidated batch reporting are grouped for audit-ready walkthroughs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/api/export/comprehensive-report">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Full TMS Report (Excel)
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/export/pdf?type=consolidated">
              <FileText className="mr-2 h-4 w-4" />
              Consolidated PDF
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/export/pdf?type=assessment">
              <FileText className="mr-2 h-4 w-4" />
              Assessment PDF
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/export/toppers">
              <Trophy className="mr-2 h-4 w-4" />
              All Toppers (Excel)
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/export/pdf?type=toppers">
              <FileText className="mr-2 h-4 w-4" />
              Toppers PDF
            </a>
          </Button>
          <DownloadReportButton quizId="all" variant="all" />
        </div>
        </div>
      </section>

      <Card className="border-zinc-200 bg-black text-white shadow-sm">
        <CardHeader>
          <CardTitle>BRD-Aligned Downloads</CardTitle>
          <CardDescription className="text-zinc-400">
            All reports use real live data. Topper reports include configurable scoring criteria sheets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { title: 'Consolidated batch report', body: 'Filter in Excel by discontinued, not cleared, offered, and onboarded candidates.' },
              { title: 'Transparent topper report', body: 'Topper score uses configured assessment/project weights and minimum attendance.' },
              { title: 'Governance audit report', body: 'Attendance upload logs, notification records, and feedback outcomes stay exportable.' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-2 text-sm text-zinc-400">{item.body}</p>
              </div>
            ))}
          </div>

          {/* Consolidated filter downloads */}
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-400 mb-3">Consolidated Report - Filter by Status</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'discontinued', 'not_cleared', 'offered', 'onboarded'] as const).map((filter) => (
                <a key={filter} href={`/api/export/consolidated?filter=${filter}`}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-colors">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {filter === 'all' ? 'All Candidates' : filter === 'not_cleared' ? 'Not Cleared' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                </a>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-batch download section */}
      {(batches || []).length > 0 && (
        <TmsBatchDownloads batches={(batches || []).map((b: any) => ({ id: b.id, title: b.title, status: b.status }))} />
      )}

      {(batches || []).length > 0 && (
        <Card className="overflow-hidden border-zinc-900 bg-black text-white shadow-[0_28px_80px_rgba(0,0,0,0.32)]">
          <CardHeader className="border-b border-white/10">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Feedback Intelligence Center</CardTitle>
                <CardDescription className="text-zinc-400">
                  Standalone feedback downloads and batch sentiment signals for BRD section 5.5.
                </CardDescription>
              </div>
              <Button asChild variant="outline" className="w-fit rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <a href="/api/export/pdf?type=feedback">
                  <FileText className="mr-2 h-4 w-4" />
                  All Feedback PDF
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {(batches || []).slice(0, 6).map((batch: any) => {
              const batchFeedback = trainingFeedback.filter((item: any) => item.batch_id === batch.id)
              const avgTrainer = batchFeedback.length
                ? (batchFeedback.reduce((sum: number, item: any) => sum + Number(item.trainer_effectiveness_rating || 0), 0) / batchFeedback.length).toFixed(1)
                : '0.0'
              const positive = batchFeedback.filter((item: any) => item.sentiment === 'positive').length
              const negative = batchFeedback.filter((item: any) => item.sentiment === 'negative').length
              return (
                <div key={batch.id} className="rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold" title={batch.title}>{batch.title}</p>
                      <p className="mt-1 text-xs text-zinc-400">{batchFeedback.length} response(s)</p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black">{avgTrainer}</div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Positive</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-200">{positive}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Negative</p>
                      <p className="mt-1 text-sm font-semibold text-rose-200">{negative}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline" className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                      <a href={`/api/export/batch-feedback?batchId=${batch.id}`}>Excel</a>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                      <a href={`/api/export/pdf?type=feedback&batchId=${batch.id}`}>PDF</a>
                    </Button>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-amber-100 bg-amber-50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-950">
              <Trophy className="h-5 w-5" />
              Topper Center
            </CardTitle>
            <CardDescription className="text-amber-800">
              Transparent ranking using {governance.topperAssessmentWeight}% assessment, {governance.topperProjectWeight}% project, and {governance.topperMinAttendance}% minimum attendance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topperRows.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-amber-200 bg-white/70 p-6 text-center text-sm text-amber-800">No topper data yet. Upload assessment scores and project evaluations to populate this board.</p>
            ) : topperRows.map((row, index) => (
              <div key={row.userId} className="grid gap-3 rounded-2xl border border-amber-200 bg-white p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">{index + 1}</div>
                <div className="min-w-0">
                  <p className="font-semibold text-amber-950">{row.name}</p>
                  <p className="text-sm text-amber-800">Assessment {row.assessmentScore}% - Project {row.projectScore}% - Attendance {row.attendanceRate}%</p>
                </div>
                <div className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">{row.topperScore}</div>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild className="rounded-full bg-black text-white hover:bg-zinc-800">
                <a href="/api/reports/training-ops/download">Export topper workbook</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle>Consolidated Batch Filters</CardTitle>
            <CardDescription>BRD status filters are visible before export and mirrored in the Excel workbook.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <FilterMetric title="Discontinued" value={statusCounts.discontinued} tone="rose" />
            <FilterMetric title="Not cleared" value={statusCounts.notCleared} tone="amber" />
            <FilterMetric title="Offered" value={statusCounts.offered} tone="blue" />
            <FilterMetric title="Onboarded / active" value={statusCounts.onboarded} tone="emerald" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-emerald-100 bg-emerald-50/40 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-950">
            <Target className="h-5 w-5 text-emerald-700" />
            Assessment Clearance Drilldown
          </CardTitle>
          <CardDescription className="text-emerald-800">
            Batch-level pass rate across imported assessment scores, using each configured assessment passing score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assessmentClearanceRows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-emerald-200 bg-white/70 p-6 text-center text-sm text-emerald-800">No imported assessment results available yet.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {assessmentClearanceRows.map((row) => (
                <div key={row.batchId} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-emerald-950" title={row.batchTitle}>{row.batchTitle}</p>
                      <p className="mt-1 text-xs text-emerald-700">{row.assessmentCount} setup(s), {row.resultCount} score row(s)</p>
                    </div>
                    <div className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-bold text-white">{row.clearanceRate}%</div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    <MetricChip label="Avg" value={`${row.averageScore}%`} />
                    <MetricChip label="Cleared" value={`${row.cleared}`} />
                    <MetricChip label="Not cleared" value={`${row.notCleared}`} />
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-emerald-100">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${row.clearanceRate}%` }} />
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">{row.signal}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trainer Performance Metrics */}
      <Card className="border-indigo-100 bg-indigo-50/30 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-950">
            <Users className="h-5 w-5 text-indigo-600" />
            Trainer Performance Metrics
          </CardTitle>
          <CardDescription className="text-indigo-800">
            Aggregated performance metrics for trainers across your visible batches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrainerPerformancePanel trainers={trainerMetrics} />
          <AiInsightCard
            type="trainer_performance"
            data={trainerMetrics.slice(0, 8).map((t: any) => ({ name: t.name, attendance: t.attendanceRate, avgScore: t.avgScore, sessions: t.sessionCount }))}
            label="AI Coaching Tip"
            className="mt-4"
          />
        </CardContent>
      </Card>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500 rounded-xl">
                <FileQuestion className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{stats.totalQuizzes}</p>
                <p className="text-xs text-blue-600/70 font-medium">Total Quizzes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-500 rounded-xl">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{stats.totalAttempts}</p>
                <p className="text-xs text-green-600/70 font-medium">Total Completions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 rounded-xl">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats.averageScore}%</p>
                <p className="text-xs text-amber-600/70 font-medium">Average Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500 rounded-xl">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{stats.uniqueEmployees}</p>
                <p className="text-xs text-purple-600/70 font-medium">Active Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Quiz Reports - individual cards with download */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Per-Quiz Reports
          </h2>
          <p className="text-sm text-muted-foreground">Download individual Excel reports for each quiz</p>
        </div>

        {quizzes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground opacity-40 mb-3" />
              <p className="text-muted-foreground">No quizzes created yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {quizzes.map((quiz: any) => {
              const data = quizAttemptData[quiz.id]
              const hasAttempts = data && data.attempts > 0
              const difficultyColors: Record<string, string> = {
                easy: 'bg-green-100 text-green-700 border-green-200',
                medium: 'bg-blue-100 text-blue-700 border-blue-200',
                hard: 'bg-amber-100 text-amber-700 border-amber-200',
                advanced: 'bg-orange-100 text-orange-700 border-orange-200',
                hardcore: 'bg-red-100 text-red-700 border-red-200',
              }
              return (
                <Card key={quiz.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{quiz.title}</CardTitle>
                        <CardDescription className="truncate mt-0.5">{quiz.topic}</CardDescription>
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-xs ${difficultyColors[quiz.difficulty] || ''}`}>
                        {quiz.difficulty}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 bg-muted/60 rounded-lg">
                        <p className="text-lg font-bold">{data?.attempts || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Attempts</p>
                      </div>
                      <div className="p-2 bg-muted/60 rounded-lg">
                        <p className={`text-lg font-bold ${hasAttempts ? (data.avgScore >= (quiz.passing_score || 70) ? 'text-green-600' : 'text-red-500') : ''}`}>
                          {hasAttempts ? `${data.avgScore}%` : '-'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Avg Score</p>
                      </div>
                      <div className="p-2 bg-muted/60 rounded-lg">
                        <p className={`text-lg font-bold ${hasAttempts ? (data.passRate >= 70 ? 'text-green-600' : data.passRate >= 40 ? 'text-amber-600' : 'text-red-500') : ''}`}>
                          {hasAttempts ? `${data.passRate}%` : '-'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Pass Rate</p>
                      </div>
                    </div>

                    {/* Pass rate bar */}
                    {hasAttempts && (
                      <div className="space-y-1">
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${data.passRate >= 70 ? 'bg-green-500' : data.passRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${data.passRate}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Status + Download */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <Badge variant={quiz.is_active ? 'default' : 'secondary'} className="text-xs">
                        {quiz.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <div className="flex flex-wrap items-center gap-2">
                        <DownloadReportButton quizId={quiz.id} quizTitle={quiz.title} />
                        <QuickDeleteButton quizId={quiz.id} quizTitle={quiz.title} hasAttempts={hasAttempts} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Domain Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Employee Distribution by Domain
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(domainCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No domain data available.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(domainCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([domain, count]) => (
                    <div key={domain} className="flex items-center gap-3">
                      <span className="text-sm w-32 truncate font-medium">{domain}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(count / employees.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-10 text-right">{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Engagement Rate</span>
              </div>
              <span className="font-bold">
                {employees.length > 0 ? Math.round((stats.uniqueEmployees / employees.length) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Avg Attempts / Quiz</span>
              </div>
              <span className="font-bold">
                {stats.totalQuizzes > 0 ? (stats.totalAttempts / stats.totalQuizzes).toFixed(1) : 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Quizzes with Attempts</span>
              </div>
              <span className="font-bold">
                {Object.keys(quizAttemptData).length} / {stats.totalQuizzes}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">Avg Pass Rate</span>
              </div>
              <span className="font-bold">
                {Object.values(quizAttemptData).length > 0
                  ? Math.round(Object.values(quizAttemptData).reduce((sum, d) => sum + d.passRate, 0) / Object.values(quizAttemptData).length)
                  : 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function FilterMetric({ title, value, tone }: { title: string; value: number; tone: 'rose' | 'amber' | 'blue' | 'emerald' }) {
  const tones = {
    rose: 'border-rose-100 bg-rose-50 text-rose-800',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    blue: 'border-blue-100 bg-blue-50 text-blue-800',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  }
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-70">{title}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2">
      <p className="text-[10px] uppercase tracking-wider text-emerald-700">{label}</p>
      <p className="mt-1 text-lg font-bold text-emerald-950">{value}</p>
    </div>
  )
}

function buildAssessmentClearanceRows(batches: any[], importedAssessments: any[], assessmentSetups: any[]) {
  const setupById = new Map(assessmentSetups.map((setup: any) => [setup.id, setup]))
  return batches.map((batch: any) => {
    const batchResults = importedAssessments.filter((result: any) => result.batch_id === batch.id)
    const batchSetups = assessmentSetups.filter((setup: any) => setup.batch_id === batch.id)
    const cleared = batchResults.filter((result: any) => {
      const setup = setupById.get(result.assessment_setup_id)
      const threshold = Number(setup?.passing_score ?? 70)
      return Number(result.percentage ?? result.candidate_score ?? 0) >= threshold
    }).length
    const resultCount = batchResults.length
    const notCleared = Math.max(0, resultCount - cleared)
    const clearanceRate = resultCount ? Math.round((cleared / resultCount) * 100) : 0
    const averageAssessmentScore = averageScore(batchResults.map((result: any) => Number(result.percentage ?? result.candidate_score ?? 0)))
    const signal = resultCount === 0
      ? 'Waiting for score upload.'
      : clearanceRate >= 80
        ? 'Healthy clearance trend.'
        : clearanceRate >= 60
          ? 'Moderate risk. Review weak assessment areas.'
          : 'Intervention needed. Clearance is below expected threshold.'

    return {
      batchId: batch.id,
      batchTitle: batch.title,
      assessmentCount: batchSetups.length,
      resultCount,
      averageScore: averageAssessmentScore,
      cleared,
      notCleared,
      clearanceRate,
      signal,
    }
  }).filter((row) => row.assessmentCount > 0 || row.resultCount > 0)
}

function buildTopperRows(
  members: any[],
  attempts: any[],
  projectEvaluations: any[],
  attendance: any[],
  importedAssessments: any[],
  governance: {
    topperAssessmentWeight: number
    topperProjectWeight: number
    topperMinAttendance: number
  }
) {
  const memberByUser = new Map(members.map((member: any) => [member.user_id, member]))
  const userIds = Array.from(memberByUser.keys())

  return userIds.map((userId) => {
    const profile = memberByUser.get(userId)?.profile
    const scores = [
      ...attempts.filter((attempt: any) => attempt.user_id === userId).map((attempt: any) => Number(attempt.score || 0)),
      ...importedAssessments
        .filter((result: any) => String(result.candidate_email || '').toLowerCase() === String(profile?.email || '').toLowerCase())
        .map((result: any) => Number(result.percentage ?? result.candidate_score ?? 0)),
    ]
    const projects = projectEvaluations.filter((item: any) => item.user_id === userId).map((item: any) => Number(item.score || 0))
    const attendanceRows = attendance.filter((item: any) => item.user_id === userId)
    const positiveAttendance = attendanceRows.filter((item: any) => ['present', 'late'].includes(item.status)).length
    const attendanceRate = attendanceRows.length ? Math.round((positiveAttendance / attendanceRows.length) * 100) : 0
    const assessmentScore = averageScore(scores)
    const projectScore = averageScore(projects)
    const topperScore = computeTopperScore({
      assessmentAvg: assessmentScore,
      projectScore,
      attendancePct: attendanceRate,
      weights: {
        assessment: governance.topperAssessmentWeight,
        project: governance.topperProjectWeight,
        minAttendance: governance.topperMinAttendance,
      },
    })

    return {
      userId,
      name: profile?.full_name || profile?.email || 'Candidate',
      assessmentScore,
      projectScore,
      attendanceRate,
      topperScore,
    }
  }).sort((a, b) => b.topperScore - a.topperScore)
}

function buildTrainerMetrics(
  batches: any[],
  batchTrainersList: any[],
  attendance: any[],
  attempts: any[],
  feedback: any[],
  projectEvaluations: any[],
  importedAssessments: any[]
) {
  const trainerMap = new Map<string, {
    id: string;
    name: string;
    email: string;
    batchIds: Set<string>;
  }>()

  // Collect trainers from batches (lead)
  for (const b of batches) {
    if (b.trainer) {
      if (!trainerMap.has(b.trainer.id)) {
        trainerMap.set(b.trainer.id, { id: b.trainer.id, name: b.trainer.full_name || b.trainer.email, email: b.trainer.email, batchIds: new Set() })
      }
      trainerMap.get(b.trainer.id)!.batchIds.add(b.id)
    }
  }

  // Collect trainers from batchTrainersList (co-trainers)
  for (const bt of batchTrainersList) {
    if (bt.trainer) {
      if (!trainerMap.has(bt.trainer.id)) {
        trainerMap.set(bt.trainer.id, { id: bt.trainer.id, name: bt.trainer.full_name || bt.trainer.email, email: bt.trainer.email, batchIds: new Set() })
      }
      trainerMap.get(bt.trainer.id)!.batchIds.add(bt.batch_id)
    }
  }

  const results = Array.from(trainerMap.values()).map(t => {
    const bIds = Array.from(t.batchIds)
    
    // Attendance
    const bAttendance = attendance.filter((a: any) => bIds.includes(a.session?.batch_id))
    const positiveAtt = bAttendance.filter((a: any) => ['present', 'late'].includes(a.status)).length
    const attendanceRate = bAttendance.length ? Math.round((positiveAtt / bAttendance.length) * 100) : 0
    
    // Assessment scores across quizzes, imported score sheets, and project evaluations
    const bAttempts = attempts.filter((a: any) => bIds.includes(a.quizzes?.batch_id))
    const bProjects = projectEvaluations.filter((item: any) => bIds.includes(item.batch_id))
    const bImports = importedAssessments.filter((item: any) => bIds.includes(item.batch_id))
    const scoreRows = [
      ...bAttempts.map((a: any) => Number(a.score || 0)),
      ...bProjects.map((item: any) => Number(item.score || 0)),
      ...bImports.map((item: any) => Number(item.percentage ?? item.candidate_score ?? 0)),
    ]
    const avgScore = scoreRows.length ? Math.round(scoreRows.reduce((sum: number, score: number) => sum + score, 0) / scoreRows.length) : 0
    
    // Feedback rating
    const bFeedback = feedback.filter((f: any) => bIds.includes(f.batch_id) && f.trainer_effectiveness_rating)
    const avgFeedback = bFeedback.length ? (bFeedback.reduce((sum: number, f: any) => sum + Number(f.trainer_effectiveness_rating || 0), 0) / bFeedback.length).toFixed(1) : '0.0'
    
    // Total score (weighted average for sorting)
    const scoreVal = avgScore * 0.4 + attendanceRate * 0.4 + (Number(avgFeedback) * 20) * 0.2
    
    return {
      ...t,
      batchesCount: bIds.length,
      attendanceRate,
      avgScore,
      avgFeedback,
      scoreVal
    }
  })

  return results.sort((a, b) => b.scoreVal - a.scoreVal)
}

