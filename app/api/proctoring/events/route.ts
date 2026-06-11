/* Use built-in Request/Response to avoid depending on next/server types */
import { z } from 'zod'
const json = (body: any, status = 200) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, status })
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getProctoringEventRisk, getProctoringRiskLevel, PROCTORING_RISK_WEIGHTS } from '@/lib/proctoring'
import { recordProctoringEvent, requireActiveProctoringSession } from '@/lib/proctoring-server'

const proctoringEventSchema = z.object({
  sessionId: z.string().uuid(),
  attemptId: z.string().uuid(),
  type: z.enum(Object.keys(PROCTORING_RISK_WEIGHTS) as [keyof typeof PROCTORING_RISK_WEIGHTS, ...(keyof typeof PROCTORING_RISK_WEIGHTS)[]]),
  label: z.string().trim().min(1).max(180),
  questionIndex: z.number().int().min(0).max(1000).optional(),
  confidence: z.number().min(0).max(1).optional().nullable(),
  detectedCount: z.number().int().min(0).max(20).optional().nullable(),
  objectLabel: z.string().trim().min(1).max(80).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  evidenceImage: z
    .string()
    .max(1_100_000, 'Evidence image is too large')
    .refine((value: string) => /^data:image\/jpe?g;base64,/i.test(value), 'Evidence must be a JPEG data URL')
    .optional()
    .nullable(),
})
const proctoringEventsPayloadSchema = z.union([
  proctoringEventSchema,
  z.array(proctoringEventSchema).min(1).max(50),
])

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  const parsed = proctoringEventsPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return json({ error: `${first.path.join('.')}: ${first.message}` }, 400)
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Not authenticated' }, 401)

  const admin = createAdminClient()
  const events = Array.isArray(parsed.data) ? parsed.data : [parsed.data]
  const firstEvent = events[0]
  const sessionResult = await requireActiveProctoringSession(admin, firstEvent.sessionId, firstEvent.attemptId, user.id)
  if (sessionResult.error || !sessionResult.data) {
    return json({ error: sessionResult.error || 'Invalid proctoring session.' }, 403)
  }

  let result: Awaited<ReturnType<typeof recordProctoringEvent>> | null = null
  for (const event of events) {
    if (event.sessionId !== firstEvent.sessionId || event.attemptId !== firstEvent.attemptId) {
      return json({ error: 'Batch contains events for different proctoring sessions.' }, 400)
    }

    result = await recordProctoringEvent({
      admin,
      session: sessionResult.data,
      type: event.type,
      label: event.label,
      questionIndex: event.questionIndex,
      confidence: event.confidence,
      detectedCount: event.detectedCount,
      objectLabel: event.objectLabel,
      metadata: event.metadata,
      evidenceImage: event.evidenceImage,
    })

    if ('error' in result && result.error) return json({ error: result.error }, 500)
  }

  if (!result || !('data' in result) || !result.data) return json({ error: 'Unable to record proctoring event.' }, 500)

  return json({
    ...result.data,
    eventRiskScore: getProctoringEventRisk(events[events.length - 1].type),
    eventRiskLevel: getProctoringRiskLevel(getProctoringEventRisk(events[events.length - 1].type)),
  }, 200)
}
