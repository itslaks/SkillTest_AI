import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUserRole, isTrainingStaff } from '@/lib/rbac'

export type CertificateAccessResult =
  | { ok: true; certificate: any; viewerId: string }
  | { ok: false; status: 401 | 403 | 404; message: string }

export async function getCertificateForViewer(certificateId: string): Promise<CertificateAccessResult> {
  const viewer = await getCurrentUserRole()
  if (!viewer) return { ok: false, status: 401, message: 'Not authenticated' }

  const admin = createAdminClient()
  const { data: certificate, error } = await admin
    .from('certificates')
    .select(`
      *,
      profile:user_id(id, full_name, email, employee_id, domain, department),
      quiz:quiz_id(id, title, topic, difficulty),
      attempt:attempt_id(id, status, review_status),
      rule:rule_id(certificate_name, template_image_url, template_accent_color, template_notes, min_score)
    `)
    .eq('id', certificateId)
    .maybeSingle()

  if (error) return { ok: false, status: 404, message: error.message }
  if (!certificate) return { ok: false, status: 404, message: 'Certificate not found' }

  const canAccess = certificate.user_id === viewer.userId || isTrainingStaff(viewer.role)
  if (!canAccess) return { ok: false, status: 403, message: 'You do not have access to this certificate' }
  if (certificate.attempt?.status && certificate.attempt.status !== 'completed') {
    return { ok: false, status: 403, message: 'This certificate is pending assessment review.' }
  }

  return { ok: true, certificate, viewerId: viewer.userId }
}

export function getCertificateDisplay(certificate: any) {
  const accent = certificate.rule?.template_accent_color || '#6f5ab8'
  const employeeName = certificate.profile?.full_name || certificate.profile?.email || 'Employee'
  const courseName = certificate.rule?.certificate_name || certificate.title || `${certificate.quiz?.topic || 'Course'} Completion`
  const topic = certificate.quiz?.topic || certificate.quiz?.title || courseName
  const issueDate = new Date(certificate.issued_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return { accent, employeeName, courseName, topic, issueDate }
}
