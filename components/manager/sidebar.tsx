'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types/database'
import {
  LayoutDashboard,
  FileQuestion,
  Users,
  BarChart3,
  Sparkles,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Brain,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { signOut } from '@/lib/actions/auth'
import { useState } from 'react'

interface ManagerSidebarProps {
  profile: Profile | null
}

const navigation = [
  { name: 'Dashboard', href: '/manager', icon: LayoutDashboard },
  { name: 'Quizzes', href: '/manager/quizzes', icon: FileQuestion },
  { name: 'Employees', href: '/manager/employees', icon: Users },
  { name: 'Leaderboard', href: '/manager/leaderboard', icon: Trophy },
  { name: 'Analytics & AI', href: '/manager/analytics', icon: Brain },
  { name: 'Reports', href: '/manager/reports', icon: BarChart3 },
]

export function ManagerSidebar({ profile }: ManagerSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const handleNavigation = (href: string) => {
    router.push(href)
  }

  return (
    <>
      {/* Mobile overlay */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm lg:hidden z-40 hidden" />
      
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 shadow-xl border-r border-border/50',
          'bg-black text-white noise-overlay',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-4 border-b border-white/10 relative z-10">
          <button
            onClick={() => handleNavigation('/manager')}
            className="flex items-center gap-3 hover-lift"
          >
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-lg">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            {!collapsed && (
              <div>
                <span className="font-bold text-lg text-white tracking-tight">SkillTest</span>
                <p className="text-[10px] text-white/50 -mt-0.5">Manager Portal</p>
              </div>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/manager' && pathname.startsWith(item.href))
            return (
              <button
                key={item.name}
                onClick={() => handleNavigation(item.href)}
                title={collapsed ? item.name : undefined}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left relative z-10',
                  isActive
                    ? 'bg-white text-black shadow-sm font-semibold'
                    : 'text-white/60 hover:bg-white/10 hover:text-white hover-lift'
                )}
              >
                <item.icon className={cn('h-5 w-5 shrink-0', isActive ? 'text-black' : '')} />
                {!collapsed && <span>{item.name}</span>}
                {!collapsed && isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-black/50" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="px-3 py-2 border-t border-white/10">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-white/50 hover:text-white hover:bg-white/10"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* User section */}
        <div className="p-3 border-t border-white/10">
          <div className={cn(
            'flex items-center gap-3 p-2 rounded-lg bg-white/5',
            collapsed && 'justify-center'
          )}>
            <Avatar className="h-9 w-9 shrink-0 ring-2 ring-white/20 hover:ring-white transition-all">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-white text-black text-sm font-bold">
                {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'M'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{profile?.full_name || 'Manager'}</p>
                <p className="text-xs text-white/50 truncate">{profile?.email}</p>
              </div>
            )}
          </div>
          <form action={signOut} className="mt-2">
            <Button 
              type="submit"
              variant="ghost" 
              size="sm" 
              className={cn(
                'text-white/50 hover:text-red-300 hover:bg-red-500/10 transition-colors',
                collapsed ? 'w-full justify-center' : 'w-full justify-start'
              )}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="ml-2">Sign Out</span>}
            </Button>
          </form>
        </div>
      </aside>
    </>
  )
}
