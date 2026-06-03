import { getProfileDashboard } from '@/lib/actions/profile'
import type React from 'react'
import Image from 'next/image'
import { getDomainColor } from '@/lib/domain-colors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  BookOpenCheck,
  CalendarCheck,
  Fingerprint,
  Mail,
  Medal,
  Trophy,
  UserRound,
} from 'lucide-react'

export default async function ProfileDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getProfileDashboard(id)

  if (result.error || !result.data) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Button variant="ghost" asChild><Link href="/profiles"><ArrowLeft className="mr-2 h-4 w-4" />Profiles</Link></Button>
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{result.error || 'Profile not found'}</div>
      </div>
    )
  }

  const { profile, stats, attempts, badges, assignments, memberships, attendance, certificates } = result.data
  const domain = profile.domain || profile.department || 'General'
  const domainStyle = getDomainColor(domain)
  const completed = attempts.filter((attempt: any) => attempt.status === 'completed')
  const averageScore = completed.length
    ? Math.round(completed.reduce((sum: number, attempt: any) => sum + Number(attempt.score || 0), 0) / completed.length)
    : 0
  const present = attendance.filter((item: any) => ['present', 'late'].includes(item.status)).length
  const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : 0

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <Button variant="ghost" asChild>
        <Link href="/profiles"><ArrowLeft className="mr-2 h-4 w-4" />Back to profiles</Link>
      </Button>

      <section className="overflow-hidden rounded-3xl border border-zinc-900 bg-black text-white shadow-[0_40px_140px_rgba(0,0,0,0.45)]">
        <div className={`h-2 bg-gradient-to-r ${domainStyle.gradient}`} />
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_320px] md:p-8">
          <div className="flex items-start gap-5">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.full_name || profile.email}
                width={80}
                height={80}
                unoptimized
                className="h-20 w-20 shrink-0 rounded-3xl border border-white bg-white object-cover shadow-lg"
              />
            ) : (
              <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br ${domainStyle.gradient} text-3xl font-bold shadow-lg`}>
                {profile.full_name?.charAt(0) || profile.email?.charAt(0) || '?'}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{profile.full_name || 'Unnamed Profile'}</h1>
                <Badge className="capitalize">{String(profile.role).replace('_', ' ')}</Badge>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
                <InfoRow icon={Fingerprint} label="Employee ID" value={profile.employee_id || 'Not assigned'} />
                <InfoRow icon={Mail} label="Email" value={profile.email || 'N/A'} />
                <InfoRow icon={UserRound} label="Domain" value={domain} />
                <InfoRow icon={BadgeCheck} label="Department" value={profile.department || 'N/A'} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric label="Points" value={stats?.total_points || 0} />
            <Metric label="Streak" value={stats?.current_streak || 0} />
            <Metric label="Avg Score" value={`${stats?.average_score ?? averageScore}%`} />
            <Metric label="Attendance" value={`${attendanceRate}%`} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-4">
        <SummaryCard icon={BookOpenCheck} label="Completed Quizzes" value={completed.length} tone="bg-blue-50 text-blue-700 border-blue-100" />
        <SummaryCard icon={Award} label="Badges Earned" value={badges.length} tone="bg-violet-50 text-violet-700 border-violet-100" />
        <SummaryCard icon={Medal} label="Certificates" value={certificates.length} tone="bg-amber-50 text-amber-700 border-amber-100" />
        <SummaryCard icon={CalendarCheck} label="Training Batches" value={memberships.length} tone="bg-emerald-50 text-emerald-700 border-emerald-100" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Quiz Performance" icon={Trophy}>
          <div className="space-y-3">
            {attempts.slice(0, 10).map((attempt: any) => (
              <div key={attempt.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{attempt.quizzes?.title || 'Quiz'}</p>
                    <p className="text-sm text-zinc-500">{attempt.quizzes?.topic || 'General'} • {attempt.quizzes?.difficulty || 'medium'}</p>
                  </div>
                  <Badge className={Number(attempt.score || 0) >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                    {attempt.status === 'completed' ? `${attempt.score}%` : attempt.status}
                  </Badge>
                </div>
              </div>
            ))}
            {attempts.length === 0 && <EmptyLine text="No quiz attempts yet." />}
          </div>
        </Panel>

        <Panel title="Badges And Certificates" icon={Award}>
          <div className="space-y-3">
            {badges.slice(0, 12).map((entry: any) => {
              const badge = entry.badges
              return (
                <div key={`${badge?.id}-${entry.earned_at}`} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{badge?.name || 'Badge'}</p>
                      <p className="text-xs text-zinc-500">{badge?.description || 'Achievement unlocked'}</p>
                    </div>
                  </div>
                </div>
              )
            })}
            {certificates.map((certificate: any) => (
              <div key={certificate.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <p className="font-semibold">{certificate.title}</p>
                <p className="text-xs">Issued for {certificate.quiz?.title || 'assessment'} on {new Date(certificate.issued_at).toLocaleDateString()}</p>
              </div>
            ))}
            {badges.length === 0 && certificates.length === 0 && <EmptyLine text="No badges or certificates yet." />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Assignments" icon={BookOpenCheck}>
          <div className="space-y-3">
            {assignments.map((assignment: any) => (
              <div key={`${assignment.quizzes?.id}-${assignment.assigned_at}`} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <p className="font-semibold">{assignment.quizzes?.title || 'Quiz'}</p>
                <p className="text-sm text-zinc-500">{assignment.quizzes?.topic || 'General'} • assigned {new Date(assignment.assigned_at).toLocaleDateString()}</p>
              </div>
            ))}
            {assignments.length === 0 && <EmptyLine text="No active quiz assignments." />}
          </div>
        </Panel>

        <Panel title="Training And Attendance" icon={CalendarCheck}>
          <div className="space-y-3">
            {memberships.map((membership: any) => (
              <div key={membership.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{membership.batch?.title || 'Training batch'}</p>
                    <p className="text-sm text-zinc-500">{membership.batch?.domain || domain}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{membership.enrollment_status}</Badge>
                </div>
              </div>
            ))}
            {memberships.length === 0 && <EmptyLine text="No batch memberships." />}
          </div>
        </Panel>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <Icon className="h-4 w-4 text-white" />
      <span className="text-zinc-500">{label}:</span>
      <span className="truncate font-medium text-white">{value}</span>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${tone}`}>
      <Icon className="h-5 w-5" />
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="text-sm font-medium opacity-80">{label}</p>
    </div>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-zinc-700" />
        <h2 className="font-semibold text-zinc-950">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-zinc-300 bg-white py-8 text-center text-sm text-zinc-500">{text}</div>
}
