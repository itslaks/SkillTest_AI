'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { signIn } from '@/lib/actions/auth'
import { Mail, Lock, Sparkles, ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)

  async function handleSignIn(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-[42%] bg-[#0f0f10] relative overflow-hidden flex-col justify-between p-12">
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
            <h2 className="text-4xl font-bold text-white leading-tight mb-4">Welcome<br />back.</h2>
            <p className="text-white/50 text-lg leading-relaxed">Pick up where you left off. Your progress, scores, and badges are all here.</p>
          </div>
          <div className="space-y-4">
            {[
              { icon: Zap, label: 'Continue your journey', desc: 'Resume quizzes right where you stopped' },
              { icon: ShieldCheck, label: 'Secure sign in', desc: 'Your account is always protected' },
              { icon: CheckCircle2, label: 'Track your growth', desc: 'See how your scores improve over time' },
            ].map(item => (
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

        <div className="relative z-10 border border-white/10 rounded-2xl p-5 bg-white/5">
          <p className="text-white/70 text-sm leading-relaxed italic">&ldquo;SkillTest made our team assessments 3&times; faster and the insights are incredibly actionable.&rdquo;</p>
          <p className="text-white/40 text-xs mt-3 font-medium">&mdash; HR Manager, Fortune 500</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative overflow-y-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-md py-8">
          {/* Mobile logo */}
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

          <form action={handleSignIn} className="space-y-4">
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                <span className="shrink-0">⚠️</span>{error}
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
              <div className="flex justify-end mt-1">
                <Link href="/auth/reset-password" className="text-xs text-primary font-semibold hover:underline underline-offset-4">Forgot password?</Link>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={isPending} className="w-full h-11 rounded-xl text-sm font-semibold border-0 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/20 transition-all group">
                {isPending ? <><Spinner className="mr-2" />Signing in&hellip;</> : <>Sign In <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></>}
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
