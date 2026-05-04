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

  const { data: batch } = await admin.from('training_batches').select('id, title, domain, status').eq('id', batchId).single()
  if (!batch) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })

  const [{ data: feedbackItems }, { data: windows }] = await Promise.all([
    admin
      .from('training_feedback')
      .select('id, rating, sentiment, feedback_text, action_item, content_quality_rating, trainer_effectiveness_rating, created_at, trainee:user_id(full_name, email, department), session:session_id(title, session_date)')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false }),
    admin
      .from('training_feedback_windows')
      .select('id, title, closes_at, status, created_at')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false }),
  ])

  const wb = XLSX.utils.book_new()

  // Summary stats
  const total = (feedbackItems || []).length
  const positive = (feedbackItems || []).filter((f: any) => f.sentiment === 'positive').length
  const negative = (feedbackItems || []).filter((f: any) => f.sentiment === 'negative').length
  const avgRating = total > 0 ? ((feedbackItems || []).reduce((sum: number, f: any) => sum + (f.rating || 0), 0) / total).toFixed(2) : '0'
  const avgContentQuality = total > 0 ? ((feedbackItems || []).reduce((sum: number, f: any) => sum + (f.content_quality_rating || 0), 0) / total).toFixed(2) : '0'
  const avgTrainerEffectiveness = total > 0 ? ((feedbackItems || []).reduce((sum: number, f: any) => sum + (f.trainer_effectiveness_rating || 0), 0) / total).toFixed(2) : '0'

  const summaryRows = [
    { Metric: 'Batch', Value: batch.title },
    { Metric: 'Total Feedback Responses', Value: total },
    { Metric: 'Positive Responses', Value: positive },
    { Metric: 'Neutral Responses', Value: total - positive - negative },
    { Metric: 'Negative Responses', Value: negative },
    { Metric: 'Average Overall Rating (out of 5)', Value: avgRating },
    { Metric: 'Average Content Quality Rating', Value: avgContentQuality },
    { Metric: 'Average Trainer Effectiveness Rating', Value: avgTrainerEffectiveness },
    { Metric: 'Feedback Windows Opened', Value: (windows || []).length },
    { Metric: 'Report Generated', Value: new Date().toLocaleString() },
  ]
  const summaryWs = XLSX.utils.json_to_sheet(summaryRows)
  summaryWs['!cols'] = [{ wch: 40 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Feedback Summary')

  // Detailed responses
  const detailRows = (feedbackItems || []).map((f: any, i: number) => ({
    '#': i + 1,
    Respondent_Name: f.trainee?.full_name || 'Anonymous',
    Respondent_Email: f.trainee?.email || '',
    Department: f.trainee?.department || '',
    Session: f.session?.title || '',
    Session_Date: f.session?.session_date ? new Date(f.session.session_date).toLocaleDateString() : '',
    Overall_Rating: f.rating,
    Content_Quality: f.content_quality_rating,
    Trainer_Effectiveness: f.trainer_effectiveness_rating,
    Sentiment: f.sentiment,
    Feedback_Text: f.feedback_text || '',
    Action_Item: f.action_item || '',
    Submitted_At: f.created_at ? new Date(f.created_at).toLocaleString() : '',
  }))
  const detailWs = XLSX.utils.json_to_sheet(detailRows)
  detailWs['!cols'] = [{ wch: 5 }, { wch: 24 }, { wch: 32 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 60 }, { wch: 50 }, { wch: 22 }]
  XLSX.utils.book_append_sheet(wb, detailWs, 'Detailed Responses')

  // Windows log
  if ((windows || []).length > 0) {
    const windowRows = (windows || []).map((w: any) => ({
      Window_Title: w.title,
      Status: w.status,
      Closes_At: w.closes_at ? new Date(w.closes_at).toLocaleString() : '',
      Created_At: w.created_at ? new Date(w.created_at).toLocaleString() : '',
    }))
    const windowWs = XLSX.utils.json_to_sheet(windowRows)
    windowWs['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 24 }, { wch: 24 }]
    XLSX.utils.book_append_sheet(wb, windowWs, 'Feedback Windows')
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `feedback-${batch.title.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
