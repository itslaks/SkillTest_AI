'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
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
  ShieldCheck,
  ShieldAlert,
  Crown,
  BookOpen,
  Bell,
  TerminalSquare,
  AlertTriangle,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Settings,
  UserCog,
  Workflow,
  ServerCog,
  MessageSquareText,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LogoutForm } from '@/components/auth/logout-form'
import { useEffect, useState } from 'react'
import { Avatar3D } from '@/components/avatar/avatar-3d'
import { getAvatar3DId } from '@/lib/avatar-options'
import { BrandLogo } from '@/components/brand/brand-logo'

interface ManagerSidebarProps {
  profile: Profile | null
}

const navigation = [
  {
    section: 'Mission Control',
    items: [
      { name: 'Overview', href: '/manager', icon: LayoutDashboard, color: 'text-sky-400', bg: 'bg-sky-400/10', activeBg: 'bg-sky-500', description: 'Operating picture' },
      { name: 'Alerts', href: '/manager/notifications', icon: Bell, color: 'text-rose-300', bg: 'bg-rose-300/10', activeBg: 'bg-rose-400', description: 'Action queue' },
      { name: 'KPIs', href: '/manager/analytics', icon: BarChart3, color: 'text-blue-300', bg: 'bg-blue-300/10', activeBg: 'bg-blue-400', description: 'Performance signals' },
      { name: 'Risk Center', href: '/manager/integrity', icon: AlertTriangle, color: 'text-red-300', bg: 'bg-red-300/10', activeBg: 'bg-red-400', description: 'Integrity risk' },
    ]
  },
  {
    section: 'Training Operations',
    items: [
      { name: 'Batches', href: '/manager/operations', icon: CalendarDays, color: 'text-cyan-400', bg: 'bg-cyan-400/10', activeBg: 'bg-cyan-500', description: 'Lifecycle control' },
      { name: 'Attendance', href: '/manager/operations#attendance', icon: ClipboardCheck, color: 'text-emerald-300', bg: 'bg-emerald-300/10', activeBg: 'bg-emerald-400', description: 'Presence records' },
      { name: 'Schedule', href: '/manager/operations#schedule', icon: CalendarDays, color: 'text-indigo-300', bg: 'bg-indigo-300/10', activeBg: 'bg-indigo-400', description: 'Sessions & plans' },
      { name: 'Feedback', href: '/manager/operations#feedback', icon: FileText, color: 'text-teal-300', bg: 'bg-teal-300/10', activeBg: 'bg-teal-400', description: 'Learner signals' },
    ]
  },
  {
    section: 'Assessments',
    items: [
      { name: 'Question Bank', href: '/manager/quizzes', icon: FileQuestion, color: 'text-violet-400', bg: 'bg-violet-400/10', activeBg: 'bg-violet-500', description: 'Questions & topics' },
      { name: 'Quiz Studio', href: '/manager/quizzes/new', icon: Sparkles, color: 'text-fuchsia-300', bg: 'bg-fuchsia-300/10', activeBg: 'bg-fuchsia-400', description: 'Create assessments' },
      { name: 'Assignments', href: '/manager/quizzes', icon: ClipboardCheck, color: 'text-purple-300', bg: 'bg-purple-300/10', activeBg: 'bg-purple-400', description: 'Assign quizzes' },
      { name: 'Results', href: '/manager/leaderboard', icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-400/10', activeBg: 'bg-amber-500', description: 'Scores & ranks' },
    ]
  },
  {
    section: 'Integrity',
    items: [
      { name: 'Proctoring Review', href: '/manager/integrity', icon: ShieldAlert, color: 'text-red-300', bg: 'bg-red-300/10', activeBg: 'bg-red-400', description: 'Review events' },
      { name: 'Evidence', href: '/manager/integrity', icon: ShieldCheck, color: 'text-orange-300', bg: 'bg-orange-300/10', activeBg: 'bg-orange-400', description: 'Evidence vault' },
      { name: 'Suspicious Attempts', href: '/manager/integrity', icon: AlertTriangle, color: 'text-rose-300', bg: 'bg-rose-300/10', activeBg: 'bg-rose-400', description: 'Flagged attempts' },
      { name: 'Audit Trail', href: '/manager/compliance', icon: FileText, color: 'text-yellow-300', bg: 'bg-yellow-300/10', activeBg: 'bg-yellow-400', description: 'Compliance log' },
    ]
  },
  {
    section: 'Learners',
    items: [
      { name: 'Employees', href: '/manager/employees', icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-400/10', activeBg: 'bg-emerald-500', description: 'Learner roster' },
      { name: 'Groups', href: '/manager/operations', icon: GraduationCap, color: 'text-lime-300', bg: 'bg-lime-300/10', activeBg: 'bg-lime-400', description: 'Batches & cohorts' },
      { name: 'Progress', href: '/profiles', icon: BarChart3, color: 'text-indigo-400', bg: 'bg-indigo-400/10', activeBg: 'bg-indigo-500', description: 'People search' },
      { name: 'Certifications', href: '/manager/admin', icon: ShieldCheck, color: 'text-yellow-400', bg: 'bg-yellow-400/10', activeBg: 'bg-yellow-500', description: 'Rules & awards' },
    ]
  },
  {
    section: 'Analytics',
    items: [
      { name: 'Insights', href: '/manager/analytics', icon: Brain, color: 'text-pink-400', bg: 'bg-pink-400/10', activeBg: 'bg-pink-500', description: 'AI signals' },
      { name: 'Leaderboards', href: '/manager/leaderboard', icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-400/10', activeBg: 'bg-amber-500', description: 'Rankings' },
      { name: 'Reports', href: '/manager/reports', icon: BarChart3, color: 'text-orange-400', bg: 'bg-orange-400/10', activeBg: 'bg-orange-500', description: 'Exports' },
      { name: 'AI Analysis', href: '/manager/analytics', icon: Brain, color: 'text-cyan-300', bg: 'bg-cyan-300/10', activeBg: 'bg-cyan-400', description: 'Assessment analysis' },
    ]
  },
  {
    section: 'Automation',
    items: [
      { name: 'Workflows', href: '/manager/operations', icon: Workflow, color: 'text-blue-300', bg: 'bg-blue-300/10', activeBg: 'bg-blue-400', description: 'Ops workflows' },
      { name: 'Notifications', href: '/manager/notifications', icon: Bell, color: 'text-rose-300', bg: 'bg-rose-300/10', activeBg: 'bg-rose-400', description: 'Delivery log' },
      { name: 'Imports', href: '/manager/employees', icon: FileText, color: 'text-green-300', bg: 'bg-green-300/10', activeBg: 'bg-green-400', description: 'Bulk data' },
      { name: 'AI Commands', href: '/manager/ai-command', icon: TerminalSquare, color: 'text-amber-300', bg: 'bg-amber-300/10', activeBg: 'bg-amber-400', description: 'Command console' },
    ]
  },
  {
    section: 'Platform',
    items: [
      { name: 'Users', href: '/manager/admin', icon: UserCog, color: 'text-yellow-400', bg: 'bg-yellow-400/10', activeBg: 'bg-yellow-500', description: 'Accounts' },
      { name: 'Roles', href: '/manager/admin', icon: Crown, color: 'text-orange-300', bg: 'bg-orange-300/10', activeBg: 'bg-orange-400', description: 'Access control' },
      { name: 'Feedback Review', href: '/manager/admin#feedback-review', icon: MessageSquareText, color: 'text-teal-300', bg: 'bg-teal-300/10', activeBg: 'bg-teal-400', description: 'Review queue' },
      { name: 'Templates', href: '/manager/docs', icon: BookOpen, color: 'text-emerald-300', bg: 'bg-emerald-300/10', activeBg: 'bg-emerald-400', description: 'Guides & files' },
      { name: 'Diagnostics', href: '/manager/diagnostics', icon: ServerCog, color: 'text-cyan-300', bg: 'bg-cyan-300/10', activeBg: 'bg-cyan-400', description: 'System health' },
      { name: 'Settings', href: '/manager/settings', icon: Settings, color: 'text-slate-300', bg: 'bg-slate-300/10', activeBg: 'bg-slate-400', description: 'Workspace config' },
    ]
  },
]

function getNavItemPath(item: { href: string }) {
  return item.href.split('#')[0]
}

function canShowNavItem(item: { href: string }, role: Profile['role'] | undefined) {
  const itemPath = getNavItemPath(item)

  if (role === 'trainer') {
    return ['/manager', '/manager/operations', '/manager/docs', '/manager/quizzes', '/manager/employees', '/manager/integrity', '/manager/notifications', '/manager/leaderboard', '/manager/reports', '/profiles'].includes(itemPath)
  }

  if (itemPath === '/manager/admin') return role === 'admin'

  return true
}

function getRoleBadge(role: string | undefined) {
  switch (role) {
    case 'admin':
      return { label: 'Admin', icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' }
    case 'trainer':
      return { label: 'Trainer', icon: BookOpen, color: 'text-violet-400', bg: 'bg-violet-500/15 border-violet-500/30' }
    case 'manager':
    case 'training_coordinator':
      return { label: 'Manager', icon: LayoutDashboard, color: 'text-sky-400', bg: 'bg-sky-500/15 border-sky-500/30' }
    default:
      return { label: 'Staff', icon: Users, color: 'text-zinc-400', bg: 'bg-zinc-500/15 border-zinc-500/30' }
  }
}

export function ManagerSidebar({ profile }: ManagerSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const roleBadge = getRoleBadge(profile?.role)
  const RoleBadgeIcon = roleBadge.icon
  const avatarId = getAvatar3DId((profile as any)?.avatar_url)
  const visibleNavigation = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canShowNavItem(item, profile?.role)),
    }))
    .filter((group) => group.items.length > 0)
  const activeItemName = visibleNavigation.flatMap((group) => group.items).find((item) => {
    const itemPath = getNavItemPath(item)
    return pathname === itemPath
  })?.name ?? visibleNavigation.flatMap((group) => group.items).find((item) => {
    const itemPath = getNavItemPath(item)
    return itemPath !== '/manager' && pathname.startsWith(itemPath)
  })?.name

  useEffect(() => {
    document.documentElement.style.setProperty('--manager-sidebar-width', collapsed ? '68px' : '16rem')
    return () => {
      document.documentElement.style.removeProperty('--manager-sidebar-width')
    }
  }, [collapsed])

  // Determine sidebar accent color based on role
  const sidebarAccent = profile?.role === 'admin'
    ? 'from-yellow-500 to-amber-600'
    : profile?.role === 'trainer'
      ? 'from-violet-500 to-orange-600'
      : 'from-blue-500 to-violet-600'

  const logoHref = profile?.role === 'admin' ? '/manager/admin' : '/manager'

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 hidden flex-col lg:flex',
        'bg-[#0f0f10] border-r border-white/[0.06]',
        collapsed ? 'w-[68px]' : 'w-64',
        // Use will-change only for the width transition to keep it GPU-accelerated
        'transition-[width] duration-200 ease-out will-change-[width]'
      )}
    >
      {/* Logo */}
      <div className={cn('flex h-16 items-center border-b border-white/[0.06] px-4', collapsed ? 'justify-center' : 'gap-3')}>
        <Link
          href={logoHref}
          prefetch
          className="flex items-center gap-3 group"
        >
          <BrandLogo variant="mark" tone="light" className="w-9" imageClassName="aspect-square" />
          {!collapsed && (
            <div className="leading-none">
              <span className="font-bold text-[15px] text-white tracking-tight">SkillTest_AI</span>
              <p className="text-[10px] text-white/55 mt-0.5 font-medium tracking-wide uppercase">
                {profile?.role === 'trainer' ? 'Mavericks Trainer Portal' : profile?.role === 'admin' ? 'Mavericks Governance' : 'Mavericks Console'}
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className="px-4 pt-3 pb-1">
          <div className={cn('flex items-center gap-1.5 rounded-xl border px-3 py-1.5', roleBadge.bg)}>
            <RoleBadgeIcon className={cn('h-3.5 w-3.5 shrink-0', roleBadge.color)} />
            <span className={cn('text-[11px] font-semibold uppercase tracking-widest', roleBadge.color)}>
              {roleBadge.label}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
        {visibleNavigation.map((group) => (
          <div key={group.section}>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest px-2 mb-1.5">{group.section}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeItemName === item.name
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    prefetch
                    title={collapsed ? item.name : undefined}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-colors duration-150 group relative',
                      collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/[0.05]'
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center rounded-lg shrink-0',
                      collapsed ? 'w-8 h-8' : 'w-7 h-7',
                      isActive ? item.bg : 'bg-white/[0.04] group-hover:bg-white/[0.08]'
                    )}>
                      <item.icon className={cn('h-4 w-4 shrink-0', isActive ? item.color : 'text-white/70 group-hover:text-white')} />
                    </div>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">
                          <span className="block text-[13px] font-semibold">{item.name}</span>
                          <span className="block text-[11px] font-normal text-white/60">{item.description}</span>
                        </span>
                        {isActive && <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', item.activeBg)} />}
                      </>
                    )}
                    {collapsed && isActive && (
                      <div className={cn('absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full', item.activeBg)} />
                    )}
                  </Link>
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
            'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/65 hover:text-white hover:bg-white/[0.05] transition-colors text-sm',
            collapsed && 'justify-center px-2.5'
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Compact view</span>}
        </button>

        {/* User */}
        <div className={cn('flex items-center gap-3 p-2 rounded-xl cursor-default', collapsed && 'justify-center')}>
          {avatarId ? (
            <Avatar3D avatarId={avatarId} size={32} className="shrink-0 ring-1 ring-white/20" />
          ) : (
            <Avatar className="h-8 w-8 shrink-0 ring-1 ring-white/20">
              <AvatarImage src={(profile as any)?.avatar_url || undefined} />
              <AvatarFallback className={cn('text-white text-xs font-bold bg-gradient-to-br', sidebarAccent)}>
                {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'M'}
              </AvatarFallback>
            </Avatar>
          )}
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white/90 truncate">{profile?.full_name || 'Staff'}</p>
              <p className="text-[11px] text-white/55 truncate">{profile?.email}</p>
            </div>
          )}
        </div>

        {/* Sign out */}
        <LogoutForm>
          <button
            type="submit"
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/65 hover:text-red-300 hover:bg-red-500/10 transition-colors text-sm group',
              collapsed && 'justify-center px-2.5'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </LogoutForm>
      </div>
    </aside>
  )
}
