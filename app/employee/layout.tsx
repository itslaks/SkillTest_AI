import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { signOut } from '@/lib/actions/auth'
import {
  LayoutDashboard,
  FileQuestion,
  Trophy,
  Award,
  Sparkles,
  LogOut,
  Star,
  Flame,
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

  const role = profile?.role || user.user_metadata?.role
  if (role === 'manager' || role === 'admin') {
    redirect('/manager')
  }

  const navigation = [
    { name: 'Dashboard', href: '/employee', icon: LayoutDashboard, color: 'text-sky-400' },
    { name: 'Quizzes', href: '/employee/quizzes', icon: FileQuestion, color: 'text-violet-400' },
    { name: 'Leaderboard', href: '/employee/leaderboard', icon: Trophy, color: 'text-amber-400' },
    { name: 'Badges', href: '/employee/badges', icon: Award, color: 'text-pink-400' },
  ]

  const { data: userStats } = await supabase
    .from('user_stats')
    .select('total_points, current_streak')
    .eq('user_id', user.id)
    .single()

  const fullName = profile?.full_name || user.user_metadata?.full_name || null

  const initials = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (profile?.email?.[0] || user.email?.[0] || 'E').toUpperCase()

  return (
    <div className="min-h-screen flex bg-[#f5f5f7]">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-[#0f0f10] fixed inset-y-0 left-0 z-50">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none tracking-tight">SkillTest</p>
            <p className="text-white/30 text-[10px] mt-0.5 uppercase tracking-widest">Employee</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="text-white/20 text-[9px] font-bold uppercase tracking-widest px-3 mb-3">Menu</p>
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
            >
              <item.icon className={`h-4 w-4 ${item.color} shrink-0`} />
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Bottom user */}
        <div className="border-t border-white/5 p-3 space-y-1 shrink-0">
          <div className="flex gap-2 px-2 pb-2">
            {userStats?.total_points !== undefined && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Star className="h-3 w-3 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400">{userStats.total_points}</span>
              </div>
            )}
            {(userStats?.current_streak ?? 0) > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <Flame className="h-3 w-3 text-orange-400" />
                <span className="text-xs font-semibold text-orange-400">{userStats?.current_streak}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-none truncate">{fullName?.split(' ')[0] || 'Employee'}</p>
              <p className="text-xs text-white/30 mt-0.5 truncate">{profile?.email || ''}</p>
            </div>
          </div>
          <form action={signOut}>
            <button type="submit" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <LogOut className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-[#0f0f10] border-b border-white/5 flex items-center justify-between px-4">
        <Link href="/employee" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold text-sm">SkillTest</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navigation.map((item) => (
            <Link key={item.name} href={item.href} className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all">
              <item.icon className={`h-4 w-4 ${item.color}`} />
            </Link>
          ))}
          <form action={signOut}>
            <button type="submit" className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </nav>
      </header>

      {/* Main content */}
      <div className="flex-1 md:ml-60">
        <main className="min-h-screen px-4 md:px-8 py-6 md:py-8 pt-20 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  )
}
