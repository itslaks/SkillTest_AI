import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { authCallbackSchema } from '@/lib/security/validation'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl

  // Validate and sanitize query parameters
  const parsed = authCallbackSchema.safeParse({
    code: searchParams.get('code'),
    next: searchParams.get('next') ?? '/',
  })

  if (!parsed.success) {
    // Invalid parameters — redirect to error page
    return NextResponse.redirect(`${origin}/auth/error?error=invalid_request`)
  }

  const { code, next } = parsed.data

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Ensure redirect stays on the same origin (prevent open redirect)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
