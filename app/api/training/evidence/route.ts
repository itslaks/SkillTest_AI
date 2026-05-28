import { createTrainingEvidenceRedirect } from '@/lib/backend/controllers/training-evidence-controller'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  return createTrainingEvidenceRedirect(request)
}
