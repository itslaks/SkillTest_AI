import { createAdminClient } from '@/lib/supabase/server'
import { requireManagerForApi } from '@/lib/rbac'
import { NextResponse } from 'next/server'
import { PRODUCT_NAME } from '@/lib/branding'

export async function GET() {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const admin = createAdminClient()
  const { data: batches } = await admin
    .from('training_batches')
    .select('id, title, status, start_date, end_date, batch_members(count), training_sessions(count), trainer:trainer_id(full_name, email)')
    .or(`created_by.eq.${userId},coordinator_id.eq.${userId},trainer_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(12)

  const batchIds = (batches || []).map((batch: any) => batch.id)
  const [feedbackRes, projectRes, automationRes, notificationsRes] = await Promise.all([
    batchIds.length ? admin.from('training_feedback').select('id, batch_id').in('batch_id', batchIds) : Promise.resolve({ data: [] }),
    batchIds.length ? admin.from('training_project_evaluations').select('id, batch_id').in('batch_id', batchIds) : Promise.resolve({ data: [] }),
    batchIds.length ? admin.from('training_automation_runs').select('id, batch_id, notifications_created').in('batch_id', batchIds) : Promise.resolve({ data: [] }),
    batchIds.length ? admin.from('training_notifications').select('id, batch_id, delivery_status').in('batch_id', batchIds) : Promise.resolve({ data: [] }),
  ])
  const notificationIds = (notificationsRes.data || []).map((item: any) => item.id).filter(Boolean)
  const dispatchRes = notificationIds.length
    ? await admin
        .from('training_notification_dispatch_log')
        .select('provider_status')
        .in('notification_id', notificationIds)
    : { data: [] }
  const dispatchLogs = dispatchRes.data || []
  const dispatchSent = dispatchLogs.filter((item: any) => item.provider_status === 'sent').length
  const dispatchFailed = dispatchLogs.filter((item: any) => item.provider_status === 'failed').length
  const dispatchLogged = dispatchLogs.filter((item: any) => item.provider_status === 'logged').length

  const lines = [
    `${PRODUCT_NAME} - Training Ops PDF Report`,
    `Generated: ${new Date().toLocaleString()}`,
    '',
    `Batches covered: ${batches?.length || 0}`,
    '',
    ...(batches || []).flatMap((batch: any, index: number) => [
      `${index + 1}. ${batch.title}`,
      `   Status: ${formatStatus(batch.status)}`,
      `   Dates: ${batch.start_date || 'TBD'} to ${batch.end_date || 'TBD'}`,
      `   Candidates: ${batch.batch_members?.[0]?.count || 0}`,
      `   Sessions: ${batch.training_sessions?.[0]?.count || 0}`,
      `   Trainer: ${batch.trainer?.full_name || batch.trainer?.email || 'Unassigned'}`,
      '',
    ]),
    `Feedback responses: ${feedbackRes.data?.length || 0}`,
    `Project evaluations: ${projectRes.data?.length || 0}`,
    `Notifications: ${notificationsRes.data?.length || 0}`,
    `Dispatch evidence: ${dispatchSent} sent, ${dispatchFailed} failed, ${dispatchLogged} logged`,
    `Automation notifications created: ${(automationRes.data || []).reduce((sum: number, item: any) => sum + Number(item.notifications_created || 0), 0)}`,
    '',
    'Detailed attendance, assessment setup, feedback, topper, project, and notification sheets are available in the Excel export.',
  ]

  const pdf = createSimplePdf(lines)
  return new NextResponse(Buffer.from(pdf, 'binary'), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="skilltest-ai-mavericks-training-ops-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}

function createSimplePdf(lines: string[]) {
  const content = [
    'BT',
    '/F1 12 Tf',
    '50 780 Td',
    ...lines.flatMap((line, index) => [
      index === 0 ? '/F1 16 Tf' : index === 1 ? '/F1 10 Tf' : '/F1 11 Tf',
      `(${escapePdf(line)}) Tj`,
      '0 -18 Td',
    ]),
    'ET',
  ].join('\n')

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const object of objects) {
    offsets.push(pdf.length)
    pdf += `${object}\n`
  }
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return pdf
}

function escapePdf(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function formatStatus(status: string) {
  return status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}
