'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Mail, Sparkles, CheckCircle2, AlertCircle, Clock, ShieldCheck } from 'lucide-react'
import { resendVerificationEmail } from '@/lib/actions/auth'

export default function SignUpSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-muted rounded-full"></div>
          <div className="h-4 w-32 bg-muted rounded"></div>
        </div>
      </div>
    }>
      <SignUpSuccessContent />
    </Suspense>
  )
}

function SignUpSuccessContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const role = searchParams.get('role')
  const isSetupResent = searchParams.get('setup') === 'resent'
  const isTrainer = role === 'trainer'
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResend() {
    if (!email) {
      setError('Email address not found. Please try logging in.')
      return
    }
    setResendLoading(true)
    setError(null)
    setResendSuccess(false)
    try {
      const result = await resendVerificationEmail(email)
      if (result.error) setError(result.error)
      else setResendSuccess(true)
    } catch {
      setError('Failed to resend verification email')
    } finally {
      setResendLoading(false)
    }
  }

  if (isTrainer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-950 via-background to-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-orange-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold">SkillTest_AI</span>
            </Link>
          </div>

          <div className="rounded-3xl border border-violet-200 bg-white shadow-xl overflow-hidden">
            <div className="bg-gradient-to-br from-violet-600 to-orange-600 p-8 text-center text-white">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Application Submitted!</h1>
              <p className="text-white/80 mt-2 text-sm">Your trainer account request is under review</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-800">
                <p className="font-semibold mb-1">What happens next?</p>
                <ul className="space-y-2 text-violet-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-violet-500" />
                    <span>The admin will review your trainer application</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-violet-500" />
                    <span>Once approved, your login credentials will work</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-violet-500" />
                    <span>Check the login page to see your approval status</span>
                  </li>
                </ul>
              </div>

              {email && (
                <p className="text-sm text-center text-muted-foreground">
                  Account registered for <strong className="text-foreground">{email}</strong>
                </p>
              )}

              <Button asChild className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-orange-600 text-white border-0">
                <Link href="/auth/login">Go to Login</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Student success page
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950/20 via-background to-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">SkillTest_AI</span>
          </Link>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-white shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-blue-600 to-violet-600 p-8 text-center text-white">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="text-white/80 mt-2 text-sm">
              {isSetupResent ? 'We sent an account setup link to ' : 'We sent a confirmation link to '}
              {email ? <strong>{email}</strong> : 'your email'}
            </p>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-xl flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {resendSuccess && (
              <div className="p-3 text-sm text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200 flex gap-2 items-start">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Verification email resent successfully!</span>
              </div>
            )}

            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                <p>
                  {isSetupResent
                    ? 'Your admin-created employee record was found. Open the setup link we sent, set your password, and your account will stay synced to that email and Employee ID.'
                    : 'Click the link in your email to verify your account, then sign in to start learning.'}
                </p>
              </div>
            </div>

            {!isSetupResent ? <p className="text-sm text-center text-muted-foreground">
              Didn&apos;t receive the email? Check spam or{' '}
              <button
                onClick={handleResend}
                disabled={resendLoading || !email}
                className="text-primary font-semibold hover:underline disabled:opacity-50"
              >
                {resendLoading ? 'Sending...' : 'resend it'}
              </button>
            </p> : null}

            <Button asChild className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white border-0">
              <Link href="/auth/login">Go to Login</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
