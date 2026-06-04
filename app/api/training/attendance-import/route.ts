import { createAdminClient } from '@/lib/supabase/server'
import { requireTrainingStaffForApi } from '@/lib/rbac'
import { sendEmail, buildUploadConfirmationEmail } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'

const VALID_STATUSES = new Set(['present', 'absent', 'late', 'excused'])

export async function POST(request: NextRequest) {
  const auth = await requireTrainingStaffForApi()
  if (auth instanceof NextResponse) return auth
  const { userId, role } = auth

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid attendance upload payload. Please retry with the attendance template.' }, { status: 400 })
  }

  const { sessionId, records, fileName, chunkIndex, chunkTotal, lateReason } = payload
  if (!sessionId || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'Session and attendance rows are required.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: session, error: sessionError } = await admin
    .from('training_sessions')
    .select('id, title, batch_id, session_date, batch:batch_id(title)')
    .eq('id', sessionId)
    .maybeSingle()

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

  const settingsRes = await admin
    .from('training_system_settings')
    .select('value')
    .eq('key', 'attendance_cutoff_time')
    .maybeSingle()
  const cutoffTime = String(settingsRes.data?.value || '10:00').replaceAll('"', '')
  const sessionDate = new Date(session.session_date)
  const [hoursRaw, minutesRaw] = cutoffTime.split(':')
  const cutoff = new Date(sessionDate)
  cutoff.setHours(Number(hoursRaw) || 10, Number(minutesRaw) || 0, 0, 0)
  const uploadedAfterCutoff = new Date() > cutoff
  const cleanLateReason = String(lateReason || '').trim()

  if (uploadedAfterCutoff && cleanLateReason.length < 10) {
    return NextResponse.json({
      error: `Attendance upload is after the ${cutoffTime} cut-off. Add a reason with at least 10 characters to continue.`,
      requiresLateReason: true,
      cutoffTime,
    }, { status: 400 })
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
  const duplicateKeys = new Set<string>()
  const seenKeys = new Set<string>()
  records.forEach((record: any) => {
    const key = normalize(record.Email || record.email || record.Candidate_Email || record.Candidate_Email_Address || record.Employee_ID || record.employee_id || record.Candidate_ID)
    if (!key) return
    if (seenKeys.has(key)) duplicateKeys.add(key)
    seenKeys.add(key)
  })

  const memberUserIds = new Set<string>()
  if (profiles?.length) {
    const { data: members } = await admin
      .from('batch_members')
      .select('user_id')
      .eq('batch_id', session.batch_id)
      .in('user_id', profiles.map((profile: any) => profile.id))
    for (const member of members || []) memberUserIds.add(member.user_id)
  }

  const errors: any[] = []
  const rows: any[] = []

  records.forEach((record: any, index: number) => {
    const email = normalize(record.Email || record.email || record.Candidate_Email || record.Candidate_Email_Address)
    const employeeId = normalize(record.Employee_ID || record.employee_id || record.Candidate_ID)
    const status = normalize(record.Status || record.status || 'present')
    const rowKey = normalize(email || employeeId)
    const profile = byEmail.get(email) || byEmployeeId.get(employeeId)

    if (rowKey && duplicateKeys.has(rowKey)) {
      errors.push({ row: index + 1, error: 'Duplicate candidate row in upload.', email, employeeId })
      return
    }

    if (!profile) {
      errors.push({ row: index + 1, error: 'Candidate not found in system.', email, employeeId })
      return
    }

    if (!memberUserIds.has(profile.id)) {
      errors.push({ row: index + 1, error: 'Candidate is not assigned to this session batch.', email, employeeId })
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

    const batchSize = 500
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const { error } = await admin
        .from('session_attendance')
        .upsert(batch, { onConflict: 'session_id,user_id' })
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    const previousByUser = new Map((previousRows || []).map((row: any) => [row.user_id, row]))
    const versionRows = rows.map((row) => {
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
    })
    for (let i = 0; i < versionRows.length; i += 500) {
      const { error: versionError } = await admin.from('session_attendance_versions').insert(versionRows.slice(i, i + 500))
      if (versionError) {
        return NextResponse.json({ error: `Attendance was saved, but version logging failed: ${versionError.message}` }, { status: 500 })
      }
    }
  }

  const { error: uploadLogError } = await admin.from('training_attendance_uploads').insert({
    session_id: sessionId,
    batch_id: session.batch_id,
    uploaded_by: userId,
    file_name: fileName || 'attendance-upload.xlsx',
    total_records: records.length,
    successful_records: rows.length,
    failed_records: errors.length,
    error_log: errors.length ? errors : null,
    uploaded_after_cutoff: uploadedAfterCutoff,
    late_reason: uploadedAfterCutoff ? cleanLateReason : null,
    chunk_index: Number.isFinite(Number(chunkIndex)) ? Number(chunkIndex) : null,
    chunk_total: Number.isFinite(Number(chunkTotal)) ? Number(chunkTotal) : null,
  })
  if (uploadLogError) {
    return NextResponse.json({ error: `Attendance was saved, but upload logging failed: ${uploadLogError.message}` }, { status: 500 })
  }

  const { data: notification, error: notificationError } = await admin.from('training_notifications').insert({
    batch_id: session.batch_id,
    session_id: sessionId,
    title: `Attendance uploaded: ${session.title}`,
    message: `${rows.length} attendance record(s) updated. ${errors.length} row(s) need review.${uploadedAfterCutoff ? ` Upload was after the ${cutoffTime} cut-off. Reason: ${cleanLateReason}` : ''}`,
    audience: 'coordinators',
    channel: 'email',
    delivery_status: 'queued',
    created_by: userId,
  }).select('id').single()
  if (notificationError) {
    return NextResponse.json({ error: `Attendance upload completed, but notification logging failed: ${notificationError.message}` }, { status: 500 })
  }

  // Send real email confirmation to uploader
  const { data: uploaderProfile } = await admin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
  if (uploaderProfile?.email) {
    const html = buildUploadConfirmationEmail({
      uploaderName: uploaderProfile.full_name || uploaderProfile.email,
      uploadType: 'attendance',
      batchTitle: (session.batch as any)?.title || 'Training Batch',
      recordCount: rows.length,
      errorCount: errors.length,
    })
    const emailResult = await sendEmail({ to: uploaderProfile.email, subject: `Attendance Upload Confirmed - ${(session.batch as any)?.title || session.title}`, html })
    if (notification?.id) {
      await admin
        .from('training_notifications')
        .update({
          delivery_status: emailResult.success ? 'sent' : 'failed',
          sent_at: emailResult.success ? new Date().toISOString() : null,
        })
        .eq('id', notification.id)
      await admin.from('training_notification_dispatch_log').insert({
        notification_id: notification.id,
        recipient_email: uploaderProfile.email,
        channel: 'email',
        provider_status: emailResult.success ? 'sent' : 'failed',
        provider_message: emailResult.error || 'Sent via Resend',
      })
    }
  } else if (notification?.id) {
    await admin
      .from('training_notifications')
      .update({ delivery_status: 'logged' })
      .eq('id', notification.id)
  }

  return NextResponse.json({
    success: true,
    totalRecords: records.length,
    successfulRecords: rows.length,
    failedRecords: errors.length,
    errors,
    uploadedAfterCutoff,
  })
}

function normalize(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim().toLowerCase()
}
