import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LogoutForm } from '@/components/auth/logout-form'
import { ProfileCompletionDialog } from '@/components/employee/profile-completion-dialog'
import { AvatarView } from '@/components/avatar/avatar-view'
import {
  LayoutDashboard,
  FileQuestion,
  Trophy,
  Award,
  LogOut,
  Star,
  Flame,
  CalendarDays,
  Settings,
} from 'lucide-react'
import { BrandLogo } from '@/components/brand/brand-logo'

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

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Role boundary: all staff roles belong in the manager area. Trainers and
  // coordinators were previously not bounced, letting them browse employee views.
  const role = profile?.role || user.user_metadata?.role
  if (role === 'manager' || role === 'admin' || role === 'trainer' || role === 'training_coordinator') {
    redirect('/manager')
  }

  const navigation = [
    { name: 'Dashboard', mobileName: 'Home', href: '/employee', icon: LayoutDashboard, color: 'text-white' },
    { name: 'Training', mobileName: 'Training', href: '/employee/training', icon: CalendarDays, color: 'text-white' },
    { name: 'Quizzes', mobileName: 'Quizzes', href: '/employee/quizzes', icon: FileQuestion, color: 'text-white' },
    { name: 'Leaderboard', mobileName: 'Ranks', href: '/employee/leaderboard', icon: Trophy, color: 'text-white' },
    { name: 'Accomplishments', mobileName: 'Badges', href: '/employee/badges', icon: Award, color: 'text-white' },
    { name: 'Profile', mobileName: 'Profile', href: '/profile/settings', icon: Settings, color: 'text-white' },
  ]

  const { data: userStats } = await supabase
    .from('user_stats')
    .select('total_points, current_streak')
    .eq('user_id', user.id)
    .single()

  const fullName = profile?.full_name || user.user_metadata?.full_name || null

  return (
    <div className="min-h-screen flex bg-[#f5f5f5]">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-black fixed inset-y-0 left-0 z-50">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/5 shrink-0">
          <BrandLogo variant="mark" tone="light" className="w-8" imageClassName="aspect-square" />
          <div>
            <p className="text-white font-bold text-sm leading-none tracking-tight">SkillTest_AI</p>
            <p className="text-white/55 text-[10px] mt-0.5 uppercase tracking-widest">Learner</p>
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
            <AvatarView
              src={profile?.avatar_url}
              alt={`${fullName || 'Employee'} avatar`}
              size={32}
              className="h-8 w-8 shrink-0 rounded-xl border border-white/10 bg-white object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-none truncate">{fullName?.split(' ')[0] || 'Employee'}</p>
              <p className="text-xs text-white/55 mt-0.5 truncate">{profile?.email || ''}</p>
            </div>
          </div>
          <LogoutForm>
            <button type="submit" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/65 hover:text-red-300 hover:bg-red-500/10 transition-all">
              <LogOut className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          </LogoutForm>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-black border-b border-white/5 px-3 py-3">
        <Link href="/employee" className="flex items-center gap-2">
          <BrandLogo variant="mark" tone="light" className="w-7" imageClassName="aspect-square" />
          <span className="text-white font-bold text-sm">SkillTest_AI</span>
        </Link>
        <nav className="-mx-3 mt-3 flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              aria-label={item.name}
              className="flex min-w-[4.35rem] shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-2 text-white/70 transition-all hover:bg-white/8 hover:text-white"
            >
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <span className="max-w-full truncate text-[10px] font-medium leading-none">{item.mobileName}</span>
            </Link>
          ))}
        </nav>
      </header>

      {/* Main content */}
      <div className="flex-1 md:ml-60">
        <main className="min-h-screen px-4 md:px-8 py-6 md:py-8 pt-32 md:pt-8">
          {children}
        </main>
      </div>
      {profile && <ProfileCompletionDialog profile={profile} />}
    </div>
  )
}
