import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { authCallbackSchema } from '@/lib/security/validation'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const type = searchParams.get('type')
  const recoveryCode = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const errorCode = searchParams.get('error_code')
  const errorDescription = searchParams.get('error_description')

  if (type === 'recovery' || type === 'invite' || tokenHash || errorCode || errorDescription) {
    const updateParams = new URLSearchParams()
    if (recoveryCode) updateParams.set('code', recoveryCode)
    if (type) updateParams.set('type', type)
    if (tokenHash) updateParams.set('token_hash', tokenHash)
    if (errorCode) updateParams.set('error_code', errorCode)
    if (errorDescription) updateParams.set('error_description', errorDescription)
    return NextResponse.redirect(`${origin}/auth/update-password${updateParams.toString() ? `?${updateParams.toString()}` : ''}`)
  }

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
