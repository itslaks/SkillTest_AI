import { NextRequest, NextResponse } from 'next/server'
import { retryFailedBrdEmailNotifications } from '@/lib/brd-notifications'

export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 50)))
  const result = await retryFailedBrdEmailNotifications(limit)
  return NextResponse.json({
    ok: !result.error,
    ranAt: new Date().toISOString(),
    ...result,
  }, { status: result.error ? 500 : 200 })
}
