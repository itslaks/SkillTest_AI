import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getProctoringEventRisk, getProctoringRiskLevel, PROCTORING_RISK_WEIGHTS } from '@/lib/proctoring'
import { recordProctoringEvent, requireActiveProctoringSession } from '@/lib/proctoring-server'

const proctoringEventSchema = z.object({
  sessionId: z.string().uuid(),
  attemptId: z.string().uuid(),
  type: z.enum(Object.keys(PROCTORING_RISK_WEIGHTS) as [keyof typeof PROCTORING_RISK_WEIGHTS, ...(keyof typeof PROCTORING_RISK_WEIGHTS)[]]),
  label: z.string().trim().min(1).max(180),
  questionIndex: z.number().int().min(0).max(1000).optional(),
  evidenceImage: z
    .string()
    .max(1_100_000, 'Evidence image is too large')
    .refine((value) => /^data:image\/jpe?g;base64,/i.test(value), 'Evidence must be a JPEG data URL')
    .optional()
    .nullable(),
})
const proctoringEventsPayloadSchema = z.union([
  proctoringEventSchema,
  z.array(proctoringEventSchema).min(1).max(50),
])

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null)
  const parsed = proctoringEventsPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return NextResponse.json({ error: `${first.path.join('.')}: ${first.message}` }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const events = Array.isArray(parsed.data) ? parsed.data : [parsed.data]
  const firstEvent = events[0]
  const sessionResult = await requireActiveProctoringSession(admin, firstEvent.sessionId, firstEvent.attemptId, user.id)
  if (sessionResult.error || !sessionResult.data) {
    return NextResponse.json({ error: sessionResult.error || 'Invalid proctoring session.' }, { status: 403 })
  }

  let result: Awaited<ReturnType<typeof recordProctoringEvent>> | null = null
  for (const event of events) {
    if (event.sessionId !== firstEvent.sessionId || event.attemptId !== firstEvent.attemptId) {
      return NextResponse.json({ error: 'Batch contains events for different proctoring sessions.' }, { status: 400 })
    }

    result = await recordProctoringEvent({
      admin,
      session: sessionResult.data,
      type: event.type,
      label: event.label,
      questionIndex: event.questionIndex,
      evidenceImage: event.evidenceImage,
    })

    if ('error' in result && result.error) return NextResponse.json({ error: result.error }, { status: 500 })
  }

  if (!result || !('data' in result) || !result.data) return NextResponse.json({ error: 'Unable to record proctoring event.' }, { status: 500 })

  return NextResponse.json({
    ...result.data,
    eventRiskScore: getProctoringEventRisk(events[events.length - 1].type),
    eventRiskLevel: getProctoringRiskLevel(getProctoringEventRisk(events[events.length - 1].type)),
  })
}
