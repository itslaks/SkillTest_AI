import { createAIChatReply, getAIChatHistory } from '@/lib/backend/controllers/ai-controller'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  return createAIChatReply(request)
}

export async function GET(request: NextRequest) {
  return getAIChatHistory(request)
}
