import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CertificatePrintButton } from '@/components/certificates/certificate-print-button'
import { CertificatePreview } from '@/components/certificates/certificate-preview'
import { SafeBackButton } from '@/components/navigation/safe-back-button'
import { getCertificateDisplay, getCertificateForViewer } from '@/lib/certificate-access'
import { ArrowLeft, CalendarDays, CheckCircle2, Fingerprint, Trophy } from 'lucide-react'

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getCertificateForViewer(id)
  if (!result.ok && result.status === 401) redirect('/auth/login')

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Button variant="ghost" asChild><Link href="/profiles"><ArrowLeft className="mr-2 h-4 w-4" />Profiles</Link></Button>
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">{result.message}</div>
      </div>
    )
  }

  const { certificate } = result
  const { accent, employeeName, topic, issueDate } = getCertificateDisplay(certificate)

  return (
    <div className="min-h-screen bg-zinc-100 p-4 print:bg-white md:p-8">
      <div className="mx-auto mb-5 flex max-w-6xl flex-wrap items-center justify-between gap-3 print:hidden">
        <SafeBackButton fallbackHref={`/profiles/${certificate.user_id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back to profile
        </SafeBackButton>
        <CertificatePrintButton certificateId={certificate.id} />
      </div>

      <section className="mx-auto max-w-6xl print:rounded-none print:border-0 print:shadow-none">
        <CertificatePreview
          employeeName={employeeName}
          topic={topic}
          certificateTitle={certificate.rule?.certificate_name || certificate.title || 'Certificate of Achievement'}
          message={certificate.message}
          issueDate={issueDate}
          score={certificate.score}
          employeeId={certificate.profile?.employee_id || null}
          templateImageUrl={certificate.rule?.template_image_url || null}
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
