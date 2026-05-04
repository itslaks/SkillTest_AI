import { NextRequest, NextResponse } from 'next/server'
import { requireManagerForApi } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  const batchId = request.nextUrl.searchParams.get('batchId')
  if (!batchId) return NextResponse.json({ error: 'batchId is required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: batch } = await admin
    .from('training_batches')
    .select('id, title, domain, status, start_date, end_date, trainer:trainer_id(full_name, email), coordinator:coordinator_id(full_name, email)')
    .eq('id', batchId)
    .single()

  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  const { data: sessions } = await admin
    .from('training_sessions')
    .select('id, title, session_date, mode, status, attendance_required')
    .eq('batch_id', batchId)
    .order('session_date', { ascending: true })

  const sessionIds = (sessions || []).map((s: any) => s.id)

  const { data: attendance } = sessionIds.length
    ? await admin
        .from('session_attendance')
        .select('session_id, user_id, status, check_in_time, notes, updated_at, profile:user_id(full_name, email, employee_id, department)')
        .in('session_id', sessionIds)
    : { data: [] }

  const { data: members } = await admin
    .from('batch_members')
    .select('user_id, enrollment_status, profile:user_id(full_name, email, employee_id, department)')
    .eq('batch_id', batchId)

  const sessionMap = new Map((sessions || []).map((s: any) => [s.id, s]))
  const attendanceByMember = new Map<string, any[]>()
  for (const entry of attendance || []) {
    const list = attendanceByMember.get(entry.user_id) || []
    list.push(entry)
    attendanceByMember.set(entry.user_id, list)
  }

  // Sheet 1: Summary per candidate
  const summaryRows = (members || []).map((member: any) => {
    const profile = member.profile
    const memberAttendance = attendanceByMember.get(member.user_id) || []
    const totalSessions = (sessions || []).filter((s: any) => s.attendance_required).length
    const presentCount = memberAttendance.filter((a: any) => a.status === 'present' || a.status === 'late').length
    const absentCount = memberAttendance.filter((a: any) => a.status === 'absent').length
    const attendancePct = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0
    return {
      Employee_ID: profile?.employee_id || '',
      Full_Name: profile?.full_name || '',
      Email: profile?.email || '',
      Department: profile?.department || '',
      Enrollment_Status: member.enrollment_status,
      Total_Sessions: totalSessions,
      Present: presentCount,
      Absent: absentCount,
      Late: memberAttendance.filter((a: any) => a.status === 'late').length,
      Excused: memberAttendance.filter((a: any) => a.status === 'excused').length,
      Attendance_Percentage: `${attendancePct}%`,
      At_Risk: attendancePct < 75 ? 'YES' : 'NO',
    }
  })

  // Sheet 2: Detailed per session
  const detailRows: any[] = []
  for (const entry of attendance || []) {
    const session = sessionMap.get(entry.session_id)
    const profile = (entry as any).profile
    detailRows.push({
      Session_Title: session?.title || '',
      Session_Date: session?.session_date ? new Date(session.session_date).toLocaleDateString() : '',
      Session_Mode: session?.mode || '',
      Employee_ID: profile?.employee_id || '',
      Full_Name: profile?.full_name || '',
      Email: profile?.email || '',
      Status: entry.status,
      Check_In_Time: entry.check_in_time ? new Date(entry.check_in_time).toLocaleString() : '',
      Notes: entry.notes || '',
      Last_Updated: entry.updated_at ? new Date(entry.updated_at).toLocaleString() : '',
    })
  }

  const wb = XLSX.utils.book_new()

  // Metadata sheet
  const metaRows = [
    { Field: 'Batch Title', Value: batch.title },
    { Field: 'Domain', Value: batch.domain || '' },
    { Field: 'Status', Value: batch.status },
    { Field: 'Start Date', Value: batch.start_date ? new Date(batch.start_date).toLocaleDateString() : '' },
    { Field: 'End Date', Value: batch.end_date ? new Date(batch.end_date).toLocaleDateString() : '' },
    { Field: 'Trainer', Value: (batch.trainer as any)?.full_name || (batch.trainer as any)?.email || '' },
    { Field: 'Coordinator', Value: (batch.coordinator as any)?.full_name || (batch.coordinator as any)?.email || '' },
    { Field: 'Total Candidates', Value: (members || []).length },
    { Field: 'Total Sessions', Value: (sessions || []).length },
    { Field: 'Report Generated', Value: new Date().toLocaleString() },
  ]
  const metaWs = XLSX.utils.json_to_sheet(metaRows)
  metaWs['!cols'] = [{ wch: 22 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, metaWs, 'Batch Info')

  const summaryWs = XLSX.utils.json_to_sheet(summaryRows)
  summaryWs['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 22 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Attendance Summary')

  const detailWs = XLSX.utils.json_to_sheet(detailRows)
  detailWs['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 32 }, { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 22 }]
  XLSX.utils.book_append_sheet(wb, detailWs, 'Detailed Attendance')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `attendance-${batch.title.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
