'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import {
  Award,
  CalendarDays,
  FileQuestion,
  Flame,
  LayoutDashboard,
  LogOut,
  Star,
  Trophy,
} from 'lucide-react'
import { AvatarView } from '@/components/avatar/avatar-view'
import { LogoutForm } from '@/components/auth/logout-form'

const navigation = [
  { name: 'Dashboard', mobileName: 'Home', href: '/employee', icon: LayoutDashboard },
  { name: 'Training', mobileName: 'Training', href: '/employee/training', icon: CalendarDays },
  { name: 'Quizzes', mobileName: 'Quizzes', href: '/employee/quizzes', icon: FileQuestion },
  { name: 'Leaderboard', mobileName: 'Ranks', href: '/employee/leaderboard', icon: Trophy },
  { name: 'Accomplishments', mobileName: 'Badges', href: '/employee/badges', icon: Award },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/employee') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function EmployeeShellNav({
  variant = 'desktop',
  enableRouteRefresh = false,
  fullName,
  email,
  avatarUrl,
  totalPoints,
  currentStreak,
}: {
  variant?: 'desktop' | 'mobile'
  enableRouteRefresh?: boolean
  fullName: string | null
  email: string
  avatarUrl?: string | null
  totalPoints?: number | null
  currentStreak?: number | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isRefreshing, startRefresh] = useTransition()
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    setIsNavigating(false)
    if (enableRouteRefresh) {
      startRefresh(() => router.refresh())
    }
  }, [enableRouteRefresh, pathname, router])

  const showTransition = isNavigating || isRefreshing
  const firstName = fullName?.split(' ')[0] || 'Employee'

  if (variant === 'mobile') {
    return (
      <nav className="-mx-3 mt-3 flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navigation.map((item) => {
          const active = isActivePath(pathname, item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-label={item.name}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                if (!active) setIsNavigating(true)
              }}
              className={`flex min-w-[4.8rem] shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-2.5 transition-all ${
                active ? 'bg-white text-black' : 'text-white/78 hover:bg-white/10 hover:text-white'
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span className="max-w-full truncate text-[11px] font-semibold leading-none">{item.mobileName}</span>
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <>
        <div className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="px-3 mb-3 text-[11px] font-bold uppercase tracking-widest text-white/55">Menu</p>
          {navigation.map((item) => {
            const active = isActivePath(pathname, item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => {
                  if (!active) setIsNavigating(true)
                }}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold transition-all ${
                  active
                    ? 'bg-white text-black shadow-[0_12px_30px_rgba(255,255,255,0.12)]'
                    : 'text-white/78 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className={`nav-indicator ${active ? 'text-cyan-300' : 'text-white/40'}`} />
                <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-black' : 'text-white'}`} />
                <span className="truncate">{item.name}</span>
              </Link>
            )
          })}
        </div>

        <div className="border-t border-white/10 p-3 space-y-2 shrink-0">
          <div className="flex gap-2 px-2 pb-1">
            {totalPoints !== undefined && totalPoints !== null && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/12 border border-amber-500/25">
                <Star className="h-3 w-3 text-amber-300" />
                <span className="text-xs font-semibold text-amber-200">{totalPoints}</span>
              </div>
            )}
            {(currentStreak ?? 0) > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/12 border border-orange-500/25">
                <Flame className="h-3 w-3 text-orange-300" />
                <span className="text-xs font-semibold text-orange-200">{currentStreak}</span>
              </div>
            )}
          </div>
          <Link
            href="/profile/settings"
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-all hover:bg-white/10 focus-visible:bg-white/10"
          >
            <AvatarView
              src={avatarUrl}
              alt={`${fullName || 'Employee'} avatar`}
              size={34}
              className="h-[34px] w-[34px] shrink-0 rounded-xl border border-white/15 bg-white object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-none truncate">{firstName}</p>
              <p className="text-xs text-white/72 mt-1 truncate">{email}</p>
            </div>
          </Link>
          <LogoutForm>
            <button type="submit" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/78 hover:text-red-200 hover:bg-red-500/12 transition-all">
              <LogOut className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          </LogoutForm>
        </div>

      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 transition-opacity duration-200 ${
          showTransition ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-[60] bg-white/35 backdrop-blur-[1px] transition-opacity duration-200 ${
          showTransition ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </>
  )
}
