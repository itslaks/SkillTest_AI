import { NextRequest, NextResponse } from 'next/server'
import { requireManagerForApi } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  const openaiKey = process.env.OPENAI_API_KEY
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY

  return NextResponse.json({
    hasOpenAI: !!openaiKey,
    hasGemini: !!geminiKey,
    hasAnyAI: !!(openaiKey || geminiKey),
    availableProviders: [
      ...(openaiKey ? ['OpenAI'] : []),
      ...(geminiKey ? ['Gemini'] : []),
    ]
  })
}
