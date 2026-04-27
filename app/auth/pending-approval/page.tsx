import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Clock, Sparkles, LogOut, CheckCircle2, Mail } from 'lucide-react'
import { signOut } from '@/lib/actions/auth'

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-950/30 via-background to-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold">SkillTest</span>
          </Link>
        </div>

        <div className="rounded-3xl border border-violet-200 bg-white shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-orange-600 p-10 text-center text-white relative overflow-hidden">
            {/* 3D floating ring */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 rounded-full border border-white/10 opacity-30" />
              <div className="absolute w-48 h-48 rounded-full border border-white/10 opacity-20" />
            </div>
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-5 backdrop-blur-sm border border-white/30">
                <Clock className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold">Account Under Review</h1>
              <p className="text-white/75 mt-2 text-sm leading-relaxed">
                Your trainer application is being reviewed by our admin team.
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-3">
              {[
                { icon: CheckCircle2, text: 'Your account has been created successfully', done: true },
                { icon: Clock, text: 'Admin is reviewing your trainer application', done: false },
                { icon: Mail, text: 'You can log in once your account is approved', done: false },
              ].map((step, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${step.done ? 'bg-emerald-50 border border-emerald-100' : 'bg-muted/30 border border-border/50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-emerald-500' : 'bg-muted'}`}>
                    <step.icon className={`h-4 w-4 ${step.done ? 'text-white' : 'text-muted-foreground'}`} />
                  </div>
                  <p className={`text-sm font-medium ${step.done ? 'text-emerald-700' : 'text-muted-foreground'}`}>{step.text}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">What to do now?</p>
              <p>There is no action required from your side. The admin will review and approve your account. Try logging in again after some time to check your status.</p>
            </div>

            <form action={signOut}>
              <Button type="submit" variant="outline" className="w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground">
              Need help?{' '}
              <a href="mailto:admin@hexaware.com" className="text-primary hover:underline font-medium">
                Contact admin@hexaware.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
