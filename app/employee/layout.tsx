import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ProfileCompletionDialog } from '@/components/employee/profile-completion-dialog'
import { BrandLogo } from '@/components/brand/brand-logo'
import { EmployeeShellNav } from '@/components/employee/employee-shell-nav'

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

        <EmployeeShellNav
          variant="desktop"
          enableRouteRefresh
          fullName={fullName}
          email={profile?.email || user.email || ''}
          avatarUrl={profile?.avatar_url}
          totalPoints={userStats?.total_points}
          currentStreak={userStats?.current_streak}
        />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-black border-b border-white/5 px-3 py-3">
        <Link href="/employee" className="flex items-center gap-2">
          <BrandLogo variant="mark" tone="light" className="w-7" imageClassName="aspect-square" />
          <span className="text-white font-bold text-sm">SkillTest_AI</span>
        </Link>
        <EmployeeShellNav
          variant="mobile"
          fullName={fullName}
          email={profile?.email || user.email || ''}
          avatarUrl={profile?.avatar_url}
          totalPoints={userStats?.total_points}
          currentStreak={userStats?.current_streak}
        />
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
