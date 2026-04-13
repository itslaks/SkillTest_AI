'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react'
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
      if (result.error) {
        setError(result.error)
      } else {
        setResendSuccess(true)
      }
    } catch (err) {
      setError('Failed to resend verification email')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">SkillTest</span>
          </Link>
        </div>

        <Card className="text-center">
          <CardHeader>
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We&apos;ve sent a confirmation link to {email ? <strong className="text-foreground">{email}</strong> : 'your email address'}. 
              Please click the link to verify your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md flex gap-2 items-start text-left">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {resendSuccess && (
              <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md flex gap-2 items-start text-left dark:bg-green-900/10 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Verification email resent successfully!</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Didn&apos;t receive the email? Check your spam folder or click below to resend.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleResend}
              disabled={resendLoading || !email}
            >
              {resendLoading ? 'Sending...' : 'Resend Verification Email'}
            </Button>
            <Button asChild className="w-full">
              <Link href="/auth/login">Back to Login</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
