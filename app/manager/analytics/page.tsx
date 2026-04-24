import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Brain, Radar, ShieldAlert, Sparkles, Users } from 'lucide-react'
import { IntelligenceDashboard } from '@/components/manager/intelligence-dashboard'
import {
  analyzeAttemptPattern,
  buildBatchProfile,
  buildRetentionChecks,
  buildTrainerImpact,
  getTopicAttempts,
} from '@/lib/insights'

export default async function AnalyticsPage() {
  const { userId } = await requireManager()
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, title, topic, difficulty, created_by, is_active')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })

  const quizIds = quizzes?.map((quiz: any) => quiz.id) || []

  const { data: attempts } = quizIds.length > 0
    ? await adminClient
        .from('quiz_attempts')
        .select('quiz_id, user_id, score, answers, completed_at, quizzes:quiz_id(id, title, topic, difficulty, created_by), profiles:user_id(full_name)')
        .in('quiz_id', quizIds)
        .eq('status', 'completed')
    : { data: [] }

  const { data: trainerProfiles } = await adminClient
    .from('profiles')
    .select('id, full_name')
    .in('id', [...new Set((quizzes || []).map((quiz: any) => quiz.created_by))])

  const totalAttempts = attempts?.length || 0
  const averageScore = totalAttempts > 0
    ? Math.round((attempts || []).reduce((sum: number, attempt: any) => sum + (attempt.score || 0), 0) / totalAttempts)
    : 0
  const overloadAttempts = (attempts || []).filter((attempt: any) =>
    (attempt.answers || []).some((answer: any) => answer.cognitiveLoadFlag)
  ).length
  const panicAttempts = (attempts || []).filter((attempt: any) =>
    analyzeAttemptPattern(attempt.answers || [], attempt.quizzes?.difficulty, getTopicAttempts(attempts || [], attempt.quizzes?.topic)).panicModeDetected
  ).length

  const antiGamingWatch = (attempts || [])
    .map((attempt: any) => {
      const analysis = analyzeAttemptPattern(
        attempt.answers || [],
        attempt.quizzes?.difficulty,
        getTopicAttempts(attempts || [], attempt.quizzes?.topic)
      )

      if (!analysis.antiGamingDetected) return null
      return {
        trainee: attempt.profiles?.full_name || 'Employee',
        topic: attempt.quizzes?.topic || 'General',
        signal: analysis.masterySignal,
      }
    })
    .filter(Boolean)
    .slice(0, 5) as Array<{ trainee: string; topic: string; signal: string }>

  const batchProfile = buildBatchProfile(attempts || [])
  const trainerImpact = buildTrainerImpact({
    quizzes: quizzes || [],
    attempts: attempts || [],
    profiles: trainerProfiles || [],
  })
  const retentionChecks = buildRetentionChecks(attempts || [])

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-zinc-900 bg-black p-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] uppercase tracking-[0.35em] text-zinc-400">
              <Sparkles className="h-3.5 w-3.5" />
              SkillTest Intelligence Layer
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Behavioral AI analytics cockpit</h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Cognitive load, emotional state, readiness forecasting, trainer impact, anti-gaming detection, and knowledge decay are now wired into the same assessment graph.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile icon={BarChart3} label="Completed attempts" value={`${totalAttempts}`} />
            <StatTile icon={Brain} label="Average score" value={`${averageScore}%`} />
            <StatTile icon={ShieldAlert} label="Cognitive overload" value={`${overloadAttempts}`} />
            <StatTile icon={Users} label="Panic-mode runs" value={`${panicAttempts}`} />
          </div>
        </div>
      </section>

      <IntelligenceDashboard
        batchProfile={batchProfile}
        trainerImpact={trainerImpact}
        retentionChecks={retentionChecks}
        antiGamingWatch={antiGamingWatch}
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <FeatureCard
          title="Predictive Readiness Score"
          body="Every quiz now receives a pre-attempt score forecast powered by streak, prior history, domain fit, and training age."
        />
        <FeatureCard
          title="Emotional State Inference"
          body="Fast wrong-answer runs now trigger a cooldown recommendation instead of treating every miss as equal."
        />
        <FeatureCard
          title="Auto Retention Check"
          body="Topics crossing the two-week gap are now surfaced through the decay tracker with baseline-versus-latest deltas."
        />
      </div>
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Brain
  label: string
  value: string
}) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">{label}</p>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
    </div>
  )
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-zinc-200 bg-white">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="text-sm leading-relaxed">{body}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-zinc-500">
        Visible in both the employee flow and trainer-facing analytics.
      </CardContent>
    </Card>
  )
}
