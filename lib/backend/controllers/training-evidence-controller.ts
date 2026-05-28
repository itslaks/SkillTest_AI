import { createServiceDbClient } from '@/lib/backend/database/supabase'
import { requireTrainingStaffForApi } from '@/lib/rbac'
import { canAccessTrainingBatch } from '@/lib/training-access'
import { NextRequest, NextResponse } from 'next/server'

export async function createTrainingEvidenceRedirect(request: NextRequest) {
  const auth = await requireTrainingStaffForApi()
  if (auth instanceof NextResponse) return auth

  const storagePath = request.nextUrl.searchParams.get('path') || ''
  const [bucket, folder, batchId] = storagePath.split('/')

  if (bucket !== 'training-evidence' || !folder || !batchId) {
    return NextResponse.json({ error: 'Invalid evidence path.' }, { status: 400 })
  }

  if (!(await canAccessTrainingBatch(batchId, auth.userId, auth.role))) {
    return NextResponse.json({ error: 'Forbidden: batch access denied' }, { status: 403 })
  }

  const objectPath = storagePath.split('/').slice(1).join('/')
  const admin = createServiceDbClient()
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(objectPath, 300)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message || 'Evidence file not found.' }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
