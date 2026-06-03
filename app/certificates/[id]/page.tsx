import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CertificatePrintButton } from '@/components/certificates/certificate-print-button'
import { ArrowLeft, Award, CalendarDays, CheckCircle2, Fingerprint, Trophy } from 'lucide-react'

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

  const accent = certificate.rule?.template_accent_color || '#d97706'
  const employeeName = certificate.profile?.full_name || certificate.profile?.email || 'Employee'
  const courseName = certificate.rule?.certificate_name || certificate.title || `${certificate.quiz?.topic || 'Course'} Completion`
  const issueDate = new Date(certificate.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-zinc-100 p-4 print:bg-white md:p-8">
      <div className="mx-auto mb-5 flex max-w-6xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Button variant="ghost" asChild>
          <Link href={`/profiles/${certificate.user_id}`}><ArrowLeft className="mr-2 h-4 w-4" />Back to profile</Link>
        </Button>
        <CertificatePrintButton />
      </div>

      <section className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.18)] print:rounded-none print:border-0 print:shadow-none">
        <div className="relative aspect-[1.414/1] min-h-[620px] overflow-hidden bg-white">
          {certificate.rule?.template_image_url ? (
            <Image
              src={certificate.rule.template_image_url}
              alt="Certificate template"
              fill
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_30%),linear-gradient(135deg,#fff7ed,#ffffff_45%,#f8fafc)]" />
          )}

          <div className="absolute inset-8 border-[10px] border-double" style={{ borderColor: accent }} />
          <div className="absolute inset-14 flex flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border-4 bg-white shadow-xl" style={{ borderColor: accent }}>
              <Award className="h-10 w-10" style={{ color: accent }} />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.45em] text-zinc-500">Certificate of Completion</p>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-zinc-950 md:text-6xl">{courseName}</h1>
            <p className="mt-8 text-sm uppercase tracking-[0.35em] text-zinc-500">Presented to</p>
            <h2 className="mt-3 max-w-4xl border-b-2 px-10 pb-3 text-4xl font-bold text-zinc-950 md:text-7xl" style={{ borderColor: accent }}>
              {employeeName}
            </h2>
            <p className="mt-8 max-w-3xl text-lg leading-relaxed text-zinc-700">
              {certificate.message || 'For successfully completing the course and meeting the certificate eligibility threshold.'}
            </p>

            <div className="mt-10 grid w-full max-w-4xl gap-3 text-left sm:grid-cols-3">
              <CertFact icon={Trophy} label="Score" value={`${certificate.score}%`} />
              <CertFact icon={CalendarDays} label="Issued" value={issueDate} />
              <CertFact icon={Fingerprint} label="Employee ID" value={certificate.profile?.employee_id || 'N/A'} />
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-2">
              <Badge variant="outline" className="bg-white/80">{certificate.quiz?.title || 'Assessment'}</Badge>
              <Badge variant="outline" className="bg-white/80">{certificate.profile?.domain || certificate.profile?.department || 'General'}</Badge>
              <Badge variant="outline" className="bg-white/80">Threshold {certificate.rule?.min_score || 70}%</Badge>
            </div>

            <div className="mt-10 flex items-center gap-2 text-sm font-semibold text-zinc-600">
              <CheckCircle2 className="h-4 w-4" style={{ color: accent }} />
              Verified by SkillTest_AI
            </div>
          </div>
        </div>
      </section>

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
