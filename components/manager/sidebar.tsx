'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types/database'
import {
  LayoutDashboard,
  FileQuestion,
  Users,
  BarChart3,
  Settings,
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
  { name: 'Settings', href: '/manager/settings', icon: Settings },
]

export function ManagerSidebar({ profile }: ManagerSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Mobile overlay */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm lg:hidden z-40 hidden" />
      
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && <span className="font-bold text-lg">SkillTest</span>}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/manager' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
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
        <div className="p-3 border-t">
          <div className={cn(
            'flex items-center gap-3',
            collapsed && 'justify-center'
          )}>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback>
                {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'M'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.full_name || 'Manager'}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              </div>
            )}
          </div>
          <form action={signOut} className="mt-3">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                'text-muted-foreground hover:text-foreground',
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
