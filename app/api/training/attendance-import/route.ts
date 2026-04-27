import { createAdminClient } from '@/lib/supabase/server'
import { requireTrainingStaffForApi } from '@/lib/rbac'
import { NextRequest, NextResponse } from 'next/server'

const VALID_STATUSES = new Set(['present', 'absent', 'late', 'excused'])

export async function POST(request: NextRequest) {
  const auth = await requireTrainingStaffForApi()
  if (auth instanceof NextResponse) return auth
  const { userId, role } = auth

  const { sessionId, records, fileName } = await request.json()
  if (!sessionId || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'Session and attendance rows are required.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: session, error: sessionError } = await admin
    .from('training_sessions')
    .select('id, title, batch_id, batch:batch_id(title)')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: sessionError?.message || 'Session not found.' }, { status: 404 })
  }

  if (role === 'trainer') {
    const { data: assignment } = await admin
      .from('training_batch_trainers')
      .select('id')
      .eq('batch_id', session.batch_id)
      .eq('trainer_id', userId)
      .maybeSingle()
    if (!assignment) {
      return NextResponse.json({ error: 'Trainer access is limited to assigned batches.' }, { status: 403 })
    }
  }

  const emails = records
    .map((row: any) => normalize(row.Email || row.email || row.Candidate_Email || row.Candidate_Email_Address))
    .filter(Boolean)
  const employeeIds = records
    .map((row: any) => normalize(row.Employee_ID || row.employee_id || row.Candidate_ID))
    .filter(Boolean)

  const profileFilters = [
    emails.length ? `email.in.(${emails.map((email: string) => `"${email}"`).join(',')})` : '',
    employeeIds.length ? `employee_id.in.(${employeeIds.map((id: string) => `"${id}"`).join(',')})` : '',
  ].filter(Boolean)

  const profilesQuery = admin
    .from('profiles')
    .select('id, email, employee_id, full_name')
  const { data: profiles } = profileFilters.length
    ? await profilesQuery.or(profileFilters.join(','))
    : { data: [] }

  const byEmail = new Map((profiles || []).map((profile: any) => [normalize(profile.email), profile]))
  const byEmployeeId = new Map((profiles || []).map((profile: any) => [normalize(profile.employee_id), profile]))
  const errors: any[] = []
  const rows: any[] = []

  records.forEach((record: any, index: number) => {
    const email = normalize(record.Email || record.email || record.Candidate_Email || record.Candidate_Email_Address)
    const employeeId = normalize(record.Employee_ID || record.employee_id || record.Candidate_ID)
    const status = normalize(record.Status || record.status || 'present')
    const profile = byEmail.get(email) || byEmployeeId.get(employeeId)

    if (!profile) {
      errors.push({ row: index + 1, error: 'Candidate not found in system.', email, employeeId })
      return
    }

    if (!VALID_STATUSES.has(status)) {
      errors.push({ row: index + 1, error: 'Invalid status. Use present, absent, late, or excused.', email, employeeId })
      return
    }

    rows.push({
      session_id: sessionId,
      user_id: profile.id,
      status,
      notes: String(record.Notes || record.notes || '').trim() || null,
      updated_by: userId,
      check_in_time: status === 'present' || status === 'late' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
  })

  if (rows.length > 0) {
    const { data: previousRows } = await admin
      .from('session_attendance')
      .select('id, session_id, user_id, status, notes')
      .eq('session_id', sessionId)
      .in('user_id', rows.map((row) => row.user_id))

    const { error } = await admin
      .from('session_attendance')
      .upsert(rows, { onConflict: 'session_id,user_id' })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const previousByUser = new Map((previousRows || []).map((row: any) => [row.user_id, row]))
    await admin.from('session_attendance_versions').insert(rows.map((row) => {
      const previous = previousByUser.get(row.user_id)
      return {
        attendance_id: previous?.id || null,
        session_id: sessionId,
        user_id: row.user_id,
        previous_status: previous?.status || null,
        new_status: row.status,
        previous_notes: previous?.notes || null,
        new_notes: row.notes,
        changed_by: userId,
        source: 'excel',
      }
    }))
  }

  await admin.from('training_attendance_uploads').insert({
    session_id: sessionId,
    batch_id: session.batch_id,
    uploaded_by: userId,
    file_name: fileName || 'attendance-upload.xlsx',
    total_records: records.length,
    successful_records: rows.length,
    failed_records: errors.length,
    error_log: errors.length ? errors : null,
  })

  await admin.from('training_notifications').insert({
    batch_id: session.batch_id,
    session_id: sessionId,
    title: `Attendance uploaded: ${session.title}`,
    message: `${rows.length} attendance record(s) updated. ${errors.length} row(s) need review.`,
    audience: 'coordinators',
    channel: 'email',
    delivery_status: 'sent',
    sent_at: new Date().toISOString(),
    created_by: userId,
  })

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
