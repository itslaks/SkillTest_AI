import { getAIStatus } from '@/lib/backend/controllers/ai-controller'

export async function GET() {
  return getAIStatus()
}
