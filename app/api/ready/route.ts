import { NextResponse } from 'next/server'
import { getReadinessSnapshot } from '@/lib/readiness'

export async function GET() {
  const snapshot = await getReadinessSnapshot()
  const ready = snapshot.status !== 'unhealthy'
  return NextResponse.json({ ready, ...snapshot }, { status: ready ? 200 : 503 })
}
