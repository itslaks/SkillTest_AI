import { downloadTrainingOpsPdfReport } from '@/lib/backend/controllers/training-report-controller'

export async function GET() {
  return downloadTrainingOpsPdfReport()
}
