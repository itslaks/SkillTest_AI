'use client'

import { Suspense, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { signIn } from '@/lib/actions/auth'
import { ArrowRight, CheckCircle2, Lock, Mail, ShieldCheck, Sparkles, Zap } from 'lucide-react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const resetSuccess = searchParams.get('reset') === 'success'
  const redirectTo = searchParams.get('redirect')

  function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) setError(result.error)
      else if (result?.redirectTo) router.push(result.redirectTo)
    })
  }

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-[42%] bg-black relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute top-0 left-0 w-72 h-72 bg-blue-600/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-72 h-72 bg-violet-600/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

        <Link href="/" className="relative z-10 flex items-center gap-3 w-fit">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">SkillTest</span>
        </Link>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-4">Welcome back.</h2>
            <p className="text-white/50 text-lg leading-relaxed">
              Managers and employees can both pick up right where they left off with guided actions and clear progress.
            </p>
          </div>
          <div className="space-y-4">
            {[
              { icon: Zap, label: 'Continue your journey', desc: 'Resume quizzes and workflows without hunting around' },
              { icon: ShieldCheck, label: 'Secure sign in', desc: 'Password recovery and updates are now more direct and reliable' },
              { icon: CheckCircle2, label: 'Track your growth', desc: 'Scores, readiness, badges, and guided next steps stay visible' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="text-xs text-white/40">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative overflow-y-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-md py-8">
          <Link href="/" className="lg:hidden inline-flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">SkillTest</span>
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">Sign in to your account</h1>
            <p className="text-muted-foreground mt-1.5">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
            {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
            {resetSuccess && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Your password was updated. Sign in with the new password you just created.</span>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input id="email" name="email" type="email" placeholder="yourname@company.com" required className="pl-11 h-11 rounded-xl border-border/70 bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-semibold">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" required className="pl-11 pr-16 h-11 rounded-xl border-border/70 bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground">Need help signing in?</span>
                <Link href="/auth/reset-password" className="text-xs text-primary font-semibold hover:underline underline-offset-4">Forgot password?</Link>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl text-sm font-semibold border-0 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/20 transition-all group">
                {isPending ? <><Spinner className="mr-2" />Signing in...</> : <>Sign In <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></>}
              </Button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/auth/sign-up" className="text-primary font-semibold hover:underline underline-offset-4">Sign up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
