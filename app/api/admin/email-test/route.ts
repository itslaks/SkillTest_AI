import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminForApi } from '@/lib/rbac'
import { sendMandatoryBrdEmail } from '@/lib/brd-notifications'

export async function POST(request: NextRequest) {
  const auth = await requireAdminForApi()
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => ({}))
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', auth.userId)
    .maybeSingle()

  const recipient = String(body.to || profile?.email || '').trim()
  if (!recipient) return NextResponse.json({ error: 'No test recipient email is available.' }, { status: 400 })

  const result = await sendMandatoryBrdEmail({
    admin,
    eventType: 'email_configuration_test',
    to: recipient,
    recipientRole: 'admin',
    subject: 'Maverick Execution Platform email configuration test',
    html: `<p>Email delivery is configured for the Maverick Execution Platform.</p><p>Requested by ${profile?.full_name || profile?.email || 'admin'}.</p>`,
  })

  return NextResponse.json({
    ok: result.success,
    logId: result.logId,
    error: result.error || null,
  }, { status: result.success ? 200 : 500 })
}
