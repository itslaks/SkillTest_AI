'use client'

import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types/database'
import {
  LayoutDashboard,
  FileQuestion,
  Users,
  BarChart3,
  CalendarDays,
  Sparkles,
  LogOut,
  Trophy,
  Brain,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { signOut } from '@/lib/actions/auth'
import { useState } from 'react'

interface ManagerSidebarProps {
  profile: Profile | null
}

const navigation = [
  {
    section: 'Main',
    items: [
      { name: 'Dashboard', href: '/manager', icon: LayoutDashboard, color: 'text-sky-400', bg: 'bg-sky-400/10', activeBg: 'bg-sky-500', description: 'Overview & stats' },
      { name: 'Training Ops', href: '/manager/operations', icon: CalendarDays, color: 'text-cyan-400', bg: 'bg-cyan-400/10', activeBg: 'bg-cyan-500', description: 'Batches & sessions' },
      { name: 'Quizzes', href: '/manager/quizzes', icon: FileQuestion, color: 'text-violet-400', bg: 'bg-violet-400/10', activeBg: 'bg-violet-500', description: 'Manage assessments' },
      { name: 'Employees', href: '/manager/employees', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10', activeBg: 'bg-emerald-500', description: 'Team management' },
    ]
  },
  {
    section: 'Insights',
    items: [
      { name: 'Leaderboard', href: '/manager/leaderboard', icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-400/10', activeBg: 'bg-amber-500', description: 'Rankings & scores' },
      { name: 'Analytics & AI', href: '/manager/analytics', icon: Brain, color: 'text-pink-400', bg: 'bg-pink-400/10', activeBg: 'bg-pink-500', description: 'AI-powered insights' },
      { name: 'Reports', href: '/manager/reports', icon: BarChart3, color: 'text-orange-400', bg: 'bg-orange-400/10', activeBg: 'bg-orange-500', description: 'Download reports' },
    ]
  },
]

export function ManagerSidebar({ profile }: ManagerSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out',
        'bg-[#0f0f10] border-r border-white/[0.06]',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn('flex h-16 items-center border-b border-white/[0.06] px-4', collapsed ? 'justify-center' : 'gap-3')}>
        <button
          onClick={() => router.push('/manager')}
          className="flex items-center gap-3 group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          {!collapsed && (
            <div className="leading-none">
              <span className="font-bold text-[15px] text-white tracking-tight">SkillTest</span>
              <p className="text-[10px] text-white/30 mt-0.5 font-medium tracking-wide uppercase">Manager</p>
            </div>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5">
        {navigation.map((group) => (
          <div key={group.section}>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-2 mb-1.5">{group.section}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/manager' && pathname.startsWith(item.href))
                return (
                  <button
                    key={item.name}
                    onClick={() => router.push(item.href)}
                    title={collapsed ? item.name : undefined}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 group relative',
                      collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/40 hover:text-white/80 hover:bg-white/[0.05]'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center rounded-lg shrink-0 transition-all',
                      collapsed ? 'w-8 h-8' : 'w-7 h-7',
                      isActive ? item.bg : 'bg-white/[0.04] group-hover:bg-white/[0.08]'
                    )}>
                      <item.icon className={cn('h-4 w-4 shrink-0', isActive ? item.color : 'text-white/40 group-hover:text-white/70')} />
                    </div>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.name}</span>
                        {isActive && <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', item.activeBg)} />}
                      </>
                    )}
                    {collapsed && isActive && (
                      <div className={cn('absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full', item.activeBg)} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-white/[0.06] p-2.5 space-y-1">
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/30 hover:text-white/70 hover:bg-white/[0.05] transition-all text-sm',
            collapsed && 'justify-center px-2.5'
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>

        {/* User */}
        <div className={cn('flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.05] transition-all cursor-default', collapsed && 'justify-center')}>
          <Avatar className="h-8 w-8 shrink-0 ring-1 ring-white/20">
            <AvatarImage src={(profile as any)?.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-xs font-bold">
              {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'M'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white/90 truncate">{profile?.full_name || 'Manager'}</p>
              <p className="text-[11px] text-white/30 truncate">{profile?.email}</p>
            </div>
          )}
        </div>

        {/* Sign out */}
        <form action={signOut}>
          <button
            type="submit"
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm group',
              collapsed && 'justify-center px-2.5'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </form>
      </div>
    </aside>
  )
}
