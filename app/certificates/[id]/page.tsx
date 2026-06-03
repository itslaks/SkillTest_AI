import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CertificatePrintButton } from '@/components/certificates/certificate-print-button'
import { CertificatePreview } from '@/components/certificates/certificate-preview'
import { ArrowLeft, CalendarDays, CheckCircle2, Fingerprint, Trophy } from 'lucide-react'

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: certificate } = await admin
    .from('certificates')
    .select(`
      *,
      profile:user_id(id, full_name, email, employee_id, domain, department),
      quiz:quiz_id(id, title, topic, difficulty),
      rule:rule_id(certificate_name, template_image_url, template_accent_color, template_notes, min_score)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!certificate) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Button variant="ghost" asChild><Link href="/profiles"><ArrowLeft className="mr-2 h-4 w-4" />Profiles</Link></Button>
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">Certificate not found.</div>
      </div>
    )
  }

  const accent = certificate.rule?.template_accent_color || '#6f5ab8'
  const employeeName = certificate.profile?.full_name || certificate.profile?.email || 'Employee'
  const courseName = certificate.rule?.certificate_name || certificate.title || `${certificate.quiz?.topic || 'Course'} Completion`
  const topic = certificate.quiz?.topic || certificate.quiz?.title || courseName
  const issueDate = new Date(certificate.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-zinc-100 p-4 print:bg-white md:p-8">
      <div className="mx-auto mb-5 flex max-w-6xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" asChild>
          <Link href={`/profiles/${certificate.user_id}`}><ArrowLeft className="mr-2 h-4 w-4" />Back to profile</Link>
        </Button>
        <CertificatePrintButton />
      </div>

      <section className="mx-auto max-w-6xl print:rounded-none print:border-0 print:shadow-none">
        <CertificatePreview
          employeeName={employeeName}
          topic={topic}
          message={certificate.message}
          accent={accent}
        />
      </section>

      <div className="mx-auto mt-5 grid max-w-6xl gap-3 text-left sm:grid-cols-3 print:hidden">
        <CertFact icon={Trophy} label="Score" value={`${certificate.score}%`} />
        <CertFact icon={CalendarDays} label="Issued" value={issueDate} />
        <CertFact icon={Fingerprint} label="Employee ID" value={certificate.profile?.employee_id || 'N/A'} />
      </div>

      <div className="mx-auto mt-4 flex max-w-6xl flex-wrap justify-center gap-2 print:hidden">
        <Badge variant="outline" className="bg-white/80">{certificate.quiz?.title || 'Assessment'}</Badge>
        <Badge variant="outline" className="bg-white/80">{certificate.profile?.domain || certificate.profile?.department || 'General'}</Badge>
        <Badge variant="outline" className="bg-white/80">Threshold {certificate.rule?.min_score || 70}%</Badge>
        <Badge variant="outline" className="bg-white/80">
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" style={{ color: accent }} />
          Verified by SkillTest_AI
        </Badge>
      </div>

      {certificate.rule?.template_notes && (
        <p className="mx-auto mt-4 max-w-6xl text-sm text-zinc-500 print:hidden">{certificate.rule.template_notes}</p>
      )}
    </div>
  )
}

function CertFact({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-zinc-950">{value}</p>
    </div>
  )
}
