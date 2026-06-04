import { createAdminClient } from '@/lib/supabase/server'
import { requireManagerForApi } from '@/lib/rbac'
import { NextRequest, NextResponse } from 'next/server'

const VALID_ENROLLMENT = new Set(['invited', 'active', 'completed', 'dropped', 'discontinued', 'not_cleared', 'offered', 'onboarded'])
const VALID_SUPPORT = new Set(['on_track', 'needs_support', 'critical'])

export async function POST(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid upload payload. Please retry with the template file.' }, { status: 400 })
  }

  const { batchId, records, fileName, chunkIndex, chunkTotal } = payload
  if (!batchId || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'Batch and candidate rows are required.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: batch, error: batchError } = await admin
    .from('training_batches')
    .select('id, title')
    .eq('id', batchId)
    .maybeSingle()

  if (batchError || !batch) {
    return NextResponse.json({ error: batchError?.message || 'Batch not found.' }, { status: 404 })
  }

  const emails = records.map((row: any) => normalize(row.Email || row.email || row.Candidate_Email_Address)).filter(Boolean)
  const employeeIds = records.map((row: any) => normalize(row.Employee_ID || row.employee_id || row.Candidate_ID)).filter(Boolean)
  const filters = [
    emails.length ? `email.in.(${emails.map((email: string) => `"${email}"`).join(',')})` : '',
    employeeIds.length ? `employee_id.in.(${employeeIds.map((id: string) => `"${id}"`).join(',')})` : '',
  ].filter(Boolean)

  const query = admin.from('profiles').select('id, email, employee_id')
  const { data: profiles } = filters.length ? await query.or(filters.join(',')) : { data: [] }
  const byEmail = new Map((profiles || []).map((profile: any) => [normalize(profile.email), profile]))
  const byEmployeeId = new Map((profiles || []).map((profile: any) => [normalize(profile.employee_id), profile]))

  const duplicateKeys = new Set<string>()
  const seenKeys = new Set<string>()
  records.forEach((record: any) => {
    const key = normalize(record.Email || record.email || record.Candidate_Email_Address || record.Employee_ID || record.employee_id || record.Candidate_ID)
    if (!key) return
    if (seenKeys.has(key)) duplicateKeys.add(key)
    seenKeys.add(key)
  })

  const errors: any[] = []
  const rows: any[] = []

  records.forEach((record: any, index: number) => {
    const email = normalize(record.Email || record.email || record.Candidate_Email_Address)
    const employeeId = normalize(record.Employee_ID || record.employee_id || record.Candidate_ID)
    const profile = byEmail.get(email) || byEmployeeId.get(employeeId)
    const enrollment = normalize(record.Enrollment_Status || record.enrollment_status || 'active')
    const support = normalize(record.Support_Status || record.support_status || 'on_track')
    const rowKey = normalize(email || employeeId)

    if (rowKey && duplicateKeys.has(rowKey)) {
      errors.push({ row: index + 1, error: 'Duplicate candidate row in upload.', email, employeeId })
      return
    }
    if (!profile) {
      errors.push({ row: index + 1, error: 'Candidate not found. Import the candidate master first.', email, employeeId })
      return
    }
    if (!VALID_ENROLLMENT.has(enrollment)) {
      errors.push({ row: index + 1, error: 'Invalid enrollment status.', email, employeeId })
      return
    }
    if (!VALID_SUPPORT.has(support)) {
      errors.push({ row: index + 1, error: 'Invalid support status.', email, employeeId })
      return
    }

    rows.push({
      batch_id: batchId,
      user_id: profile.id,
      enrollment_status: enrollment,
      support_status: support,
    })
  })

  if (rows.length) {
    const { data: previousRows } = await admin
      .from('batch_members')
      .select('*')
      .eq('batch_id', batchId)
      .in('user_id', rows.map((row) => row.user_id))

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from('batch_members').upsert(rows.slice(i, i + 500), { onConflict: 'batch_id,user_id' })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const previousByUser = new Map((previousRows || []).map((row: any) => [row.user_id, row]))
    const { error: auditError } = await admin.from('training_batch_change_audit').insert({
      batch_id: batchId,
      change_type: 'batch_candidate_excel_import',
      previous_value: { existing_members_updated: previousRows?.length || 0 },
      new_value: {
        file_name: fileName || null,
        chunk_index: Number.isFinite(Number(chunkIndex)) ? Number(chunkIndex) : null,
        chunk_total: Number.isFinite(Number(chunkTotal)) ? Number(chunkTotal) : null,
        successful_records: rows.length,
        failed_records: errors.length,
        inserted_or_updated_user_ids: rows.map((row) => row.user_id),
        updated_user_ids: rows.filter((row) => previousByUser.has(row.user_id)).map((row) => row.user_id),
      },
      changed_by: userId,
    })
    if (auditError) {
      return NextResponse.json({ error: `Candidate rows were saved, but audit logging failed: ${auditError.message}` }, { status: 500 })
    }
  }

  const { error: notificationError } = await admin.from('training_notifications').insert({
    batch_id: batchId,
    title: `Candidate upload processed: ${batch.title}`,
    message: `${rows.length} candidate(s) assigned from ${fileName || 'candidate upload'}. ${errors.length} row(s) need review.`,
    audience: 'coordinators',
    channel: 'email',
    delivery_status: 'sent',
    sent_at: new Date().toISOString(),
    created_by: userId,
  })
  if (notificationError) {
    return NextResponse.json({ error: `Candidate upload completed, but notification logging failed: ${notificationError.message}` }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    totalRecords: records.length,
    successfulRecords: rows.length,
    failedRecords: errors.length,
    errors,
  })
}

function normalize(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim().toLowerCase()
}
