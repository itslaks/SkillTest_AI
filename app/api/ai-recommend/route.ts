import { createLearnerRecommendation } from '@/lib/backend/controllers/ai-controller'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  return createLearnerRecommendation(request)
}
