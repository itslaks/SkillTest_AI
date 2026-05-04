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
    .select('id, title, domain, status')
    .eq('id', batchId)
    .single()
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  const [{ data: assessmentUploads }, { data: assessmentSetups }, { data: projectEvals }] = await Promise.all([
    admin
      .from('training_assessment_uploads')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false }),
    admin
      .from('training_assessment_setups')
      .select('*')
      .eq('batch_id', batchId)
      .order('scheduled_at', { ascending: true }),
    admin
      .from('training_project_evaluations')
      .select('*, trainee:user_id(full_name, email, employee_id, department), evaluator:evaluator_id(full_name, email)')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false }),
  ])

  // Also pull from assessment_import results for this batch
  const { data: importResults } = await admin
    .from('training_assessment_results')
    .select('*')
    .eq('batch_id', batchId)
    .order('appeared_on', { ascending: false })

  const wb = XLSX.utils.book_new()

  // Sheet: Assessment Setups
  const setupRows = (assessmentSetups || []).map((s: any) => ({
    Assessment_Title: s.title,
    Type: s.assessment_type,
    Scheduled_At: s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : '',
    Max_Score: s.max_score,
    Passing_Score: s.passing_score,
    Status: s.status,
    Template: s.template_name || '',
    Question_File: s.question_file_name || '',
    Created_At: new Date(s.created_at).toLocaleDateString(),
  }))
  if (setupRows.length) {
    const ws = XLSX.utils.json_to_sheet(setupRows)
    ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Assessment Schedule')
  }

  // Sheet: Candidate Scores (from import results)
  const scoreRows = (importResults || []).map((r: any) => ({
    Candidate_ID: r.candidate_id || '',
    Candidate_Name: r.candidate_name || '',
    Candidate_Email: r.candidate_email || '',
    Test_Name: r.test_name || '',
    Test_Status: r.test_status || '',
    Score: r.candidate_score,
    Max_Score: r.test_score,
    Percentage: `${r.percentage}%`,
    Performance_Category: r.performance_category || '',
    Percentile: r.percentile,
    Total_Questions: r.total_questions,
    Correct: r.correct,
    Wrong: r.wrong,
    Not_Answered: r.not_answered,
    Time_Taken_Mins: r.time_taken_minutes,
    Appeared_On: r.appeared_on ? new Date(r.appeared_on).toLocaleDateString() : '',
  }))
  if (scoreRows.length) {
    const ws = XLSX.utils.json_to_sheet(scoreRows)
    ws['!cols'] = Array(16).fill({ wch: 18 })
    XLSX.utils.book_append_sheet(wb, ws, 'Candidate Scores')
  }

  // Sheet: Project Evaluations
  const projectRows = (projectEvals || []).map((e: any) => ({
    Employee_ID: e.trainee?.employee_id || '',
    Candidate_Name: e.trainee?.full_name || '',
    Candidate_Email: e.trainee?.email || '',
    Department: e.trainee?.department || '',
    Project_Title: e.project_title,
    Score: e.score,
    Evidence_File: e.evidence_file_name || '',
    Remarks: e.remarks || '',
    Evaluator: e.evaluator?.full_name || e.evaluator?.email || '',
    Evaluated_At: e.updated_at ? new Date(e.updated_at).toLocaleDateString() : '',
  }))
  if (projectRows.length) {
    const ws = XLSX.utils.json_to_sheet(projectRows)
    ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 32 }, { wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 40 }, { wch: 24 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Project Evaluations')
  }

  // Sheet: Upload Log
  const uploadLogRows = (assessmentUploads || []).map((u: any) => ({
    File_Name: u.file_name,
    Assessment_Type: u.assessment_type || '',
    Total_Records: u.total_records,
    Successful: u.inserted_records,
    Errors: u.error_count,
    Uploaded_At: new Date(u.created_at).toLocaleString(),
  }))
  if (uploadLogRows.length) {
    const ws = XLSX.utils.json_to_sheet(uploadLogRows)
    ws['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 22 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Upload Log')
  }

  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.json_to_sheet([{ message: 'No assessment data found for this batch.' }])
    XLSX.utils.book_append_sheet(wb, ws, 'No Data')
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `assessment-scores-${batch.title.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
