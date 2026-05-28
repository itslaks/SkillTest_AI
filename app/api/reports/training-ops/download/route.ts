import { downloadTrainingOpsEvidencePack } from '@/lib/backend/controllers/training-report-controller'

export async function GET() {
  return downloadTrainingOpsEvidencePack()
}
