import { NextRequest, NextResponse } from 'next/server'
import { runTrainingAutomationSweep, type TrainingAutomationRunType } from '@/lib/actions/training'

const RUN_TYPES: TrainingAutomationRunType[] = [
  'attendance_cutoff',
  'absence_streak',
  'assessment_reminder',
  'feedback_reminder',
  'quiz_reminder',
  'ai_command_reminder',
]

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requestedRunType = request.nextUrl.searchParams.get('runType') as TrainingAutomationRunType | null
  const runTypes = requestedRunType && RUN_TYPES.includes(requestedRunType)
    ? [requestedRunType]
    : RUN_TYPES

  const results = []
  for (const runType of runTypes) {
    const result = await runTrainingAutomationSweep({
      runType,
      notes: 'Scheduled governance sweep from Vercel Cron.',
    })
    results.push({ runType, ...result })
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    results,
  })
}
