import { createClient } from '@/lib/supabase/server'
import { requireManagerForApi } from '@/lib/rbac'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const supabase = await createClient()

  try {
    const { quizId, records, fileName } = await request.json()

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No records provided' }, { status: 400 })
    }

    // Create import record
    const { data: importRecord, error: importError } = await supabase
      .from('assessment_imports')
      .insert({
        quiz_id: quizId || null,
        uploaded_by: userId,
        file_name: fileName || 'assessment_import.csv',
        total_records: records.length,
        status: 'processing',
      })
      .select()
      .single()

    if (importError) {
      console.error('Import record error:', importError)
      return NextResponse.json({ error: importError.message }, { status: 500 })
    }

    // Parse and insert assessment results
    const resultsToInsert = records.map((record: any) => ({
      import_id: importRecord.id,
      quiz_id: quizId || null,
      candidate_id: record.Candidate_ID || record.candidate_id,
      candidate_name: record.Candidate_Full_Name || record.candidate_name || 'Unknown',
      candidate_email: record.Candidate_Email_Address || record.candidate_email || '',
      test_id: record.Test_Id || record.test_id,
      test_name: record.Test_Name || record.test_name,
      test_status: record.Test_Status || record.test_status,
      test_link_name: record.Test_Link_Name || record.test_link_name,
      test_score: parseInt(record.Test_Score) || 0,
      candidate_score: parseInt(record.Candidate_Score) || 0,
      negative_points: parseInt(record.Test_Negative_Points) || 0,
      percentage: parseFloat(record.Percentage) || 0,
      performance_category: record.Performance_Category || record.performance_category,
      percentile: parseInt(record.Percentile) || 0,
      total_questions: parseInt(record.Total_Questions) || 0,
      answered: parseInt(record.Answered) || record.GIT_Assessment_Answered || 0,
      not_answered: parseInt(record.Not_Answered) || record.GIT_Assessment_Not_Answered || 0,
      correct: parseInt(record.Correct) || record.GIT_Assessment_Correct || 0,
      wrong: parseInt(record.Wrong) || record.GIT_Assessment_Wrong || 0,
      test_duration_minutes: parseInt(record['Test_Duration(minutes)']) || 0,
      time_taken_minutes: parseFloat(record['Time_Taken(minutes)']) || 0,
      avg_test_time_minutes: parseFloat(record['Avg_Test_Time(Minutes)']) || 0,
      completion_time_flag: record.Completion_Time_Flag || record.completion_time_flag,
      proctoring_flag: record.Proctoring_Flag || record.proctoring_flag,
      window_violation: parseInt(record.Window_Violation) || 0,
      time_violation_seconds: parseInt(record['Time_Violation(seconds)']) || 0,
      invited_by_email: record.Invited_By_Email_Address || record.invited_by_email,
      appeared_on: record.Appeared_On ? parseDate(record.Appeared_On) : null,
      candidate_feedback: record.Candidate_Feedback || record.candidate_feedback,
      applicant_id: record.Applicant_ID || record.applicant_id,
      test_navigation_type: record['Test Navigation Type'] || record.test_navigation_type,
      section_data: extractSectionData(record),
    }))

    // Insert results in batches
    const batchSize = 50
    let insertedCount = 0
    const errors: any[] = []

    for (let i = 0; i < resultsToInsert.length; i += batchSize) {
      const batch = resultsToInsert.slice(i, i + batchSize)
      const { error: batchError } = await supabase
        .from('assessment_results')
        .insert(batch)

      if (batchError) {
        errors.push({ batch: i / batchSize, error: batchError.message })
      } else {
        insertedCount += batch.length
      }
    }

    // Update import status
    await supabase
      .from('assessment_imports')
      .update({
        status: errors.length === 0 ? 'completed' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id)

    return NextResponse.json({
      success: true,
      importId: importRecord.id,
      totalRecords: records.length,
      insertedRecords: insertedCount,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (error: any) {
    console.error('Assessment import error:', error)
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 })
  }
}

function parseDate(dateStr: string): string | null {
  try {
    // Handle format like "02-Apr-2026 03:18 PM"
    const months: Record<string, string> = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    }
    
    const match = dateStr.match(/(\d{2})-(\w{3})-(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i)
    if (match) {
      let [, day, month, year, hour, minute, ampm] = match
      let hourNum = parseInt(hour)
      if (ampm.toUpperCase() === 'PM' && hourNum !== 12) hourNum += 12
      if (ampm.toUpperCase() === 'AM' && hourNum === 12) hourNum = 0
      
      return `${year}-${months[month]}-${day}T${hourNum.toString().padStart(2, '0')}:${minute}:00Z`
    }
    return null
  } catch {
    return null
  }
}

function extractSectionData(record: any): Record<string, any> {
  const sectionData: Record<string, any> = {}
  
  // Extract GIT Assessment specific fields
  const gitFields = [
    'GIT Assessment_Total_Score',
    'GIT Assessment_Candidate_Score',
    'GIT Assessment_Negative_Points',
    'GIT Assessment_Section_Percentage',
    'GIT Assessment_Questions',
    'GIT Assessment_Not_Answered',
    'GIT Assessment_Answered',
    'GIT Assessment_Correct',
    'GIT Assessment_Wrong',
  ]

  for (const field of gitFields) {
    if (record[field] !== undefined && record[field] !== '') {
      const key = field.replace('GIT Assessment_', '')
      sectionData[key] = record[field]
    }
  }

  return Object.keys(sectionData).length > 0 ? sectionData : {}
}

// GET endpoint to fetch assessment results
export async function GET(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const quizId = searchParams.get('quizId')
  const importId = searchParams.get('importId')

  try {
    let query = supabase
      .from('assessment_results')
      .select(`
        *,
        assessment_imports!inner(uploaded_by)
      `)
      .eq('assessment_imports.uploaded_by', userId)
      .order('percentage', { ascending: false })

    if (quizId) {
      query = query.eq('quiz_id', quizId)
    }

    if (importId) {
      query = query.eq('import_id', importId)
    }

    const { data, error } = await query.limit(500)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
