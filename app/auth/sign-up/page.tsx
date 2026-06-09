'use client'

import { Suspense, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { signUp } from '@/lib/actions/auth'
import { DOMAIN_OPTIONS } from '@/lib/domain-options'
import {
  Mail, Lock, User, Building, Sparkles, ArrowRight, CheckCircle2,
  ShieldCheck, Zap, GraduationCap, BookOpen, Clock, Star
} from 'lucide-react'

type SignUpRole = 'employee' | 'trainer'

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showPassword, setShowPassword] = useState(false)
  const initialRole = searchParams.get('role') === 'trainer' ? 'trainer' : 'employee'
  const initialEmail = searchParams.get('email') || ''
  const initialEmployeeId = searchParams.get('employeeId') || searchParams.get('employee_id') || ''
  const [selectedRole, setSelectedRole] = useState<SignUpRole>(initialRole)

  function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    formData.set('role', selectedRole)
    startTransition(async () => {
      const result = await signUp(formData)
      if (result?.error) setError(result.error)
      else if (result?.redirectTo) router.push(result.redirectTo)
    })
  }

  const isTrainer = selectedRole === 'trainer'

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left branding panel */}
      <div className={`signal-shell dashboard-grid-bg hidden lg:flex lg:w-[42%] relative overflow-hidden flex-col justify-between p-12 transition-colors duration-500 ${isTrainer ? 'bg-[#0d0a1a]' : 'bg-[#0f0f10]'}`}>
        {/* Animated gradient blobs */}
        <div className={`aura-ring -left-16 -top-16 h-96 w-96 transition-colors duration-500 ${isTrainer ? 'bg-violet-500/25' : 'bg-cyan-400/24'}`} />
        <div className={`aura-ring -bottom-16 -right-10 h-96 w-96 transition-colors duration-500 ${isTrainer ? 'bg-orange-500/20' : 'bg-violet-500/22'}`} style={{ animationDelay: '1.2s' }} />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />

        {/* 3D floating card element */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 perspective-1000">
          <div
            className="signal-card w-52 h-64 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 shadow-2xl"
            style={{
              transform: 'rotateY(-15deg) rotateX(5deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            <div className={`w-10 h-10 rounded-2xl mb-4 flex items-center justify-center ${isTrainer ? 'bg-violet-500/30' : 'bg-blue-500/30'}`}>
              {isTrainer ? <BookOpen className="w-5 h-5 text-violet-300" /> : <GraduationCap className="w-5 h-5 text-blue-300" />}
            </div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">{isTrainer ? 'Trainer Portal' : 'Student Portal'}</p>
            <p className="text-white font-semibold text-sm leading-tight">{isTrainer ? 'Shape the next generation of talent' : 'Your learning journey starts here'}</p>
            <div className="mt-4 space-y-2">
              {(isTrainer
                ? ['Create quizzes', 'Track batches', 'Score insights']
                : ['Take assessments', 'Earn badges', 'Track progress']
              ).map(item => (
                <div key={item} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${isTrainer ? 'bg-violet-400' : 'bg-cyan-400'}`} />
                  <span className="text-xs text-white/60">{item}</span>
                </div>
              ))}
            </div>
            {/* 3D shine effect */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
          </div>
          {/* Shadow cast */}
          <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 w-40 h-6 rounded-full blur-xl opacity-60 ${isTrainer ? 'bg-violet-600' : 'bg-blue-600'}`} />
        </div>

        <Link href="/" className="relative z-10 flex items-center gap-3 w-fit">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-colors duration-500 ${isTrainer ? 'bg-gradient-to-br from-violet-500 to-orange-600' : 'bg-gradient-to-br from-blue-500 to-violet-600'}`}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">SkillTest_AI</span>
          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/55">Mavericks Execution Platform</span>
        </Link>

        <div className="relative z-10 space-y-8 max-w-xs">
          <div>
            <h2 className="font-display text-5xl font-semibold text-white leading-tight mb-4">
              {isTrainer ? <>Train smarter,<br />not harder.</> : <>Your skills,<br />measured right.</>}
            </h2>
            <p className="text-white/50 text-base leading-relaxed">
              {isTrainer
                ? 'Join as a trainer and access powerful tools to design, deploy, and measure assessments.'
                : 'Join thousands of employees taking smarter assessments powered by AI.'}
            </p>
          </div>
          <div className="space-y-4">
            {(isTrainer ? [
              { icon: Zap, label: 'Admin-approved access', desc: 'Your account is reviewed before activation' },
              { icon: ShieldCheck, label: 'Secure & professional', desc: 'Enterprise-grade platform controls' },
              { icon: Star, label: 'Full analytics suite', desc: 'Measure student outcomes in real time' },
            ] : [
              { icon: Zap, label: 'AI-powered assessments', desc: 'Smart questions tailored to your role' },
              { icon: ShieldCheck, label: 'Secure & private', desc: 'Your data is always protected' },
              { icon: CheckCircle2, label: 'Instant results', desc: 'Know your score right away' },
            ]).map(item => (
              <div key={item.label} className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <item.icon className={`h-4 w-4 ${isTrainer ? 'text-violet-400' : 'text-blue-400'}`} />
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

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative overflow-y-auto">
        <div className="absolute inset-0 mesh-bg pointer-events-none" />
        <div className={`aura-ring right-8 top-8 h-72 w-72 pointer-events-none transition-colors duration-500 ${isTrainer ? 'bg-violet-300/25' : 'bg-cyan-300/25'}`} />

        <div className="signal-shell relative z-10 w-full max-w-md rounded-[2rem] border border-zinc-200 bg-white/92 p-6 py-8 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur md:p-8">
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden inline-flex items-center gap-2.5 mb-8">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-md ${isTrainer ? 'bg-gradient-to-br from-violet-500 to-orange-600' : 'bg-gradient-to-br from-blue-500 to-violet-600'}`}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">SkillTest_AI</span>
          </Link>

          <div className="mb-6">
            <h1 className="font-display text-4xl font-semibold tracking-tight">Create your account</h1>
            <p className="text-muted-foreground mt-1.5">Choose your role to get started</p>
          </div>

          {/* Role Selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setSelectedRole('employee')}
              className={`relative rounded-2xl border-2 p-4 text-left transition-all duration-200 focus:outline-none ${
                selectedRole === 'employee'
                  ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                  : 'border-border hover:border-blue-200 hover:bg-muted/30'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${selectedRole === 'employee' ? 'bg-blue-500' : 'bg-muted'}`}>
                <GraduationCap className={`h-5 w-5 ${selectedRole === 'employee' ? 'text-white' : 'text-muted-foreground'}`} />
              </div>
              <p className={`font-semibold text-sm ${selectedRole === 'employee' ? 'text-blue-700' : ''}`}>Student</p>
              <p className="text-xs text-muted-foreground mt-0.5">Instant access</p>
              {selectedRole === 'employee' && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSelectedRole('trainer')}
              className={`relative rounded-2xl border-2 p-4 text-left transition-all duration-200 focus:outline-none ${
                selectedRole === 'trainer'
                  ? 'border-violet-500 bg-violet-50 shadow-lg shadow-violet-100'
                  : 'border-border hover:border-violet-200 hover:bg-muted/30'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${selectedRole === 'trainer' ? 'bg-violet-500' : 'bg-muted'}`}>
                <BookOpen className={`h-5 w-5 ${selectedRole === 'trainer' ? 'text-white' : 'text-muted-foreground'}`} />
              </div>
              <p className={`font-semibold text-sm ${selectedRole === 'trainer' ? 'text-violet-700' : ''}`}>Trainer</p>
              <p className="text-xs text-muted-foreground mt-0.5">Needs approval</p>
              {selectedRole === 'trainer' && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          </div>

          {/* Trainer info banner */}
          {isTrainer && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 mb-4">
              <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <p>Your trainer account will be reviewed by an admin before you can log in. You&apos;ll see your status on your next login attempt.</p>
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-4">
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-sm font-semibold">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input id="fullName" name="fullName" type="text" placeholder="Your full name" required className="pl-11 h-11 rounded-xl border-border/70 bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input id="email" name="email" type="email" placeholder="yourname@company.com" defaultValue={initialEmail} required className="pl-11 h-11 rounded-xl border-border/70 bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30" />
              </div>
              <p className="text-xs text-muted-foreground">Use your official work or corporate email</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="employeeId" className="text-sm font-semibold">
                  Employee ID
                  {!isTrainer && <span className="ml-1 text-red-500">*</span>}
                </label>
                <Input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  placeholder="e.g., EMP1024"
                  defaultValue={initialEmployeeId}
                  required={!isTrainer}
                  className="h-11 rounded-xl border-border/70 bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="domain" className="text-sm font-semibold">Domain / Vertical</label>
                <Select name="domain" defaultValue="Data Engineering" required>
                  <SelectTrigger id="domain" className="h-11 w-full rounded-xl border-border/70 bg-muted/30">
                    <SelectValue placeholder="Select domain" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOMAIN_OPTIONS.map((domain) => (
                      <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-semibold">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="Create a secure password" required minLength={6} className="pl-11 pr-16 h-11 rounded-xl border-border/70 bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="department" className="text-sm font-semibold flex items-center gap-2">
                Department
                <span className="text-xs font-normal text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted">Optional</span>
              </label>
              <div className="relative">
                <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input id="department" name="department" type="text" placeholder="e.g., Engineering, Marketing, HR" className="pl-11 h-11 rounded-xl border-border/70 bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/30" />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isPending}
                className={`w-full h-11 rounded-xl text-sm font-semibold border-0 shadow-lg transition-all group ${
                  isTrainer
                    ? 'bg-gradient-to-r from-violet-600 to-orange-600 hover:from-violet-700 hover:to-orange-700 shadow-violet-500/20'
                    : 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-blue-500/20'
                }`}
              >
                {isPending
                  ? <><Spinner className="mr-2" />Creating account&hellip;</>
                  : <>{isTrainer ? 'Submit Trainer Application' : 'Create Student Account'} <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></>
                }
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground pt-1">
              By creating an account you agree to our{' '}
              <span className="text-foreground/70 font-medium hover:underline cursor-pointer">Terms of Service</span>{' '}and{' '}
              <span className="text-foreground/70 font-medium hover:underline cursor-pointer">Privacy Policy</span>
            </p>
          </form>

          <div className="mt-8 pt-6 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary font-semibold hover:underline underline-offset-4">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  )
}
