import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { signOut } from '@/lib/actions/auth'
import {
  LayoutDashboard,
  FileQuestion,
  Trophy,
  Award,
  Settings,
  Sparkles,
  LogOut,
} from 'lucide-react'

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const navigation = [
    { name: 'Dashboard', href: '/employee', icon: LayoutDashboard },
    { name: 'Quizzes', href: '/employee/quizzes', icon: FileQuestion },
    { name: 'Leaderboard', href: '/employee/leaderboard', icon: Trophy },
    { name: 'Badges', href: '/employee/badges', icon: Award },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/employee" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg hidden sm:block">AssessHub</span>
            </Link>
            <nav className="flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden md:block">{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">{profile?.full_name || 'Employee'}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
            <form action={signOut}>
              <button type="submit" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-accent">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
