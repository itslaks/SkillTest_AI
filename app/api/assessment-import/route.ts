import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireTrainingStaffForApi } from '@/lib/rbac'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, buildUploadConfirmationEmail } from '@/lib/email'
import { canTrainerAccessBatch } from '@/lib/training-access'

export async function POST(request: NextRequest) {
  const auth = await requireTrainingStaffForApi()
  if (auth instanceof NextResponse) return auth
  const { userId, role } = auth

  const supabase = await createClient()

  try {
    const { quizId, batchId, assessmentSetupId, records, fileName, chunkIndex, chunkTotal } = await request.json()

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'No records provided' }, { status: 400 })
    }

    if (role === 'trainer') {
      if (!batchId) {
        return NextResponse.json({ error: 'Trainer uploads must target an assigned batch.' }, { status: 403 })
      }
      const allowed = await canTrainerAccessBatch(batchId, userId)
      if (!allowed) {
        return NextResponse.json({ error: 'Trainer access is limited to assigned batches.' }, { status: 403 })
      }
    }

    if (batchId && assessmentSetupId) {
      const admin = createAdminClient()
      const { data: setup } = await admin
        .from('training_assessment_setups')
        .select('id')
        .eq('id', assessmentSetupId)
        .eq('batch_id', batchId)
        .maybeSingle()
      if (!setup) {
        return NextResponse.json({ error: 'Assessment setup does not belong to the selected batch.' }, { status: 400 })
      }
    }

    const seenFingerprints = new Set<string>()
    const validationErrors: any[] = []
    const cleanRecords = records.filter((record: any, index: number) => {
      const candidateEmail = rowString(record, 'Candidate_Email_Address', 'candidate_email', 'Candidate_Email').toLowerCase()
      const candidateId = rowString(record, 'Candidate_ID', 'candidate_id').toLowerCase()
      const percentage = rowNumber(record, 0, 'Percentage', 'percentage')
      const candidateScore = rowNumber(record, 0, 'Candidate_Score', 'candidate_score')
      const testId = rowString(record, 'Test_Id', 'test_id')
      const fingerprint = `${batchId || quizId || 'global'}:${assessmentSetupId || testId || 'assessment'}:${candidateEmail || candidateId}`

      if (!candidateEmail && !candidateId) {
        validationErrors.push({ row: index + 1, error: 'Missing candidate email or candidate ID.' })
        return false
      }
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100 || candidateScore < 0) {
        validationErrors.push({ row: index + 1, error: 'Invalid score range.' })
        return false
      }
      if (seenFingerprints.has(fingerprint)) {
        validationErrors.push({ row: index + 1, error: 'Duplicate candidate assessment row in upload.' })
        return false
      }
      seenFingerprints.add(fingerprint)
      record.__uploadFingerprint = fingerprint
      return true
    })

    const candidateEmails = cleanRecords
      .map((record: any) => rowString(record, 'Candidate_Email_Address', 'candidate_email', 'Candidate_Email').toLowerCase())
      .filter(Boolean)
    const { data: profiles } = candidateEmails.length
      ? await supabase.from('profiles').select('id, email').in('email', candidateEmails)
      : { data: [] }
    const existingEmails = new Set((profiles || []).map((profile: any) => String(profile.email).toLowerCase()))
    const profileIdByEmail = new Map((profiles || []).map((profile: any) => [String(profile.email).toLowerCase(), profile.id]))
    const memberUserIds = new Set<string>()
    if (batchId && profiles?.length) {
      const { data: members } = await supabase
        .from('batch_members')
        .select('user_id')
        .eq('batch_id', batchId)
        .in('user_id', profiles.map((profile: any) => profile.id))
      for (const member of members || []) memberUserIds.add(member.user_id)
    }
    const fingerprints = cleanRecords.map((record: any) => record.__uploadFingerprint).filter(Boolean)
    const { data: existingRows } = fingerprints.length
      ? await supabase
          .from('assessment_results')
          .select('upload_fingerprint')
          .in('upload_fingerprint', fingerprints)
      : { data: [] }
    const existingFingerprints = new Set((existingRows || []).map((row: any) => row.upload_fingerprint))
    const candidateCheckedRecords = cleanRecords.filter((record: any, index: number) => {
      const email = rowString(record, 'Candidate_Email_Address', 'candidate_email', 'Candidate_Email').toLowerCase()
      if (email && !existingEmails.has(email)) {
        validationErrors.push({ row: index + 1, error: 'Candidate does not exist in candidate master.', email })
        return false
      }
      const profileId = profileIdByEmail.get(email)
      if (batchId && profileId && !memberUserIds.has(profileId)) {
        validationErrors.push({ row: index + 1, error: 'Candidate is not assigned to the selected batch.', email })
        return false
      }
      if (record.__uploadFingerprint && existingFingerprints.has(record.__uploadFingerprint)) {
        validationErrors.push({ row: index + 1, error: 'Duplicate upload already exists for this candidate and assessment.', email })
        return false
      }
      return true
    })

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
    const resultsToInsert = candidateCheckedRecords.map((record: any) => ({
      import_id: importRecord.id,
      quiz_id: quizId || null,
      batch_id: batchId || null,
      assessment_setup_id: assessmentSetupId || null,
      uploaded_by: userId,
      upload_fingerprint: record.__uploadFingerprint || null,
      candidate_id: rowString(record, 'Candidate_ID', 'candidate_id') || null,
      candidate_name: rowString(record, 'Candidate_Full_Name', 'candidate_name', 'Candidate_Name') || 'Unknown',
      candidate_email: rowString(record, 'Candidate_Email_Address', 'candidate_email', 'Candidate_Email'),
      test_id: rowString(record, 'Test_Id', 'test_id') || null,
      test_name: rowString(record, 'Test_Name', 'test_name') || null,
      test_status: rowString(record, 'Test_Status', 'test_status') || null,
      test_link_name: rowString(record, 'Test_Link_Name', 'test_link_name') || null,
      test_score: rowNumber(record, 0, 'Test_Score', 'test_score'),
      candidate_score: rowNumber(record, 0, 'Candidate_Score', 'candidate_score'),
      negative_points: rowNumber(record, 0, 'Test_Negative_Points', 'negative_points'),
      percentage: rowNumber(record, 0, 'Percentage', 'percentage'),
      performance_category: rowString(record, 'Performance_Category', 'performance_category') || null,
      percentile: rowNumber(record, 0, 'Percentile', 'percentile'),
      total_questions: rowNumber(record, 0, 'Total_Questions', 'total_questions'),
      answered: rowNumber(record, 0, 'Answered', 'answered', 'GIT_Assessment_Answered'),
      not_answered: rowNumber(record, 0, 'Not_Answered', 'not_answered', 'GIT_Assessment_Not_Answered'),
      correct: rowNumber(record, 0, 'Correct', 'correct', 'GIT_Assessment_Correct'),
      wrong: rowNumber(record, 0, 'Wrong', 'wrong', 'GIT_Assessment_Wrong'),
      test_duration_minutes: rowNumber(record, 0, 'Test_Duration(minutes)', 'test_duration_minutes'),
      time_taken_minutes: rowNumber(record, 0, 'Time_Taken(minutes)', 'time_taken_minutes'),
      avg_test_time_minutes: rowNumber(record, 0, 'Avg_Test_Time(Minutes)', 'avg_test_time_minutes'),
      completion_time_flag: rowString(record, 'Completion_Time_Flag', 'completion_time_flag') || null,
      proctoring_flag: rowString(record, 'Proctoring_Flag', 'proctoring_flag') || null,
      window_violation: rowNumber(record, 0, 'Window_Violation', 'window_violation'),
      time_violation_seconds: rowNumber(record, 0, 'Time_Violation(seconds)', 'time_violation_seconds'),
      invited_by_email: rowString(record, 'Invited_By_Email_Address', 'invited_by_email') || null,
      appeared_on: rowString(record, 'Appeared_On', 'appeared_on') ? parseDate(rowString(record, 'Appeared_On', 'appeared_on')) : null,
      candidate_feedback: rowString(record, 'Candidate_Feedback', 'candidate_feedback') || null,
      applicant_id: rowString(record, 'Applicant_ID', 'applicant_id') || null,
      test_navigation_type: rowString(record, 'Test Navigation Type', 'test_navigation_type') || null,
      section_data: extractSectionData(record),
    }))

    // Insert results in batches
    const batchSize = 500
    let insertedCount = 0
    const errors: any[] = [...validationErrors]

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
        status: errors.length === 0 ? 'completed' : insertedCount > 0 ? 'completed' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id)

    if (batchId) {
      await supabase.from('training_assessment_uploads').insert({
        assessment_setup_id: assessmentSetupId || null,
        batch_id: batchId,
        uploaded_by: userId,
        file_name: fileName || 'assessment_import.csv',
        total_records: records.length,
        successful_records: insertedCount,
        failed_records: errors.length,
        duplicate_records: validationErrors.filter((item) => String(item.error).toLowerCase().includes('duplicate')).length,
        error_log: errors.length ? errors : null,
        chunk_index: Number.isFinite(Number(chunkIndex)) ? Number(chunkIndex) : null,
        chunk_total: Number.isFinite(Number(chunkTotal)) ? Number(chunkTotal) : null,
      })
    }

    // Send upload confirmation email to uploader
    try {
      const { data: uploaderProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single()
      if (uploaderProfile?.email) {
        const emailHtml = buildUploadConfirmationEmail({
          uploaderName: uploaderProfile.full_name || 'Trainer',
          uploadType: 'assessment_scores',
          batchTitle: batchId || 'Assessment Import',
          recordCount: records.length,
          errorCount: errors.length,
        })
        await sendEmail({
          to: uploaderProfile.email,
          subject: `Assessment Upload Confirmed - ${insertedCount} records imported`,
          html: emailHtml,
        })
      }
    } catch (emailErr) {
      console.warn('Upload confirmation email failed (non-fatal):', emailErr)
    }

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

function rowValue(record: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key]
  }

  const normalizedKeys = new Set(keys.map(normalizeKey))
  const match = Object.keys(record).find((key) => normalizedKeys.has(normalizeKey(key)))
  return match ? record[match] : undefined
}

function rowString(record: Record<string, any>, ...keys: string[]) {
  const value = rowValue(record, ...keys)
  return value === undefined || value === null ? '' : String(value).trim()
}

function rowNumber(record: Record<string, any>, fallback: number, ...keys: string[]) {
  const value = Number(rowValue(record, ...keys))
  return Number.isFinite(value) ? value : fallback
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
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
  const auth = await requireTrainingStaffForApi()
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
