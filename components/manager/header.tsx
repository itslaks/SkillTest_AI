'use client'

import { Bell, Search, Plus, HelpCircle, FileQuestion, CalendarDays, FileSpreadsheet, BarChart3, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Profile } from '@/lib/types/database'
import { getNotificationVerb, type StaffNotification } from '@/lib/notifications'
import { signOut } from '@/lib/actions/auth'

interface ManagerHeaderProps {
  profile: Profile | null
  notifications?: StaffNotification[]
}

export function ManagerHeader({ profile, notifications = [] }: ManagerHeaderProps) {

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/50 bg-white/98 backdrop-blur-md px-4 md:px-6">
      <div className="flex-1 flex items-center gap-3">
        <div className="relative max-w-md flex-1 hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            type="search"
            placeholder="Search quizzes, employees..."
            className="pl-9 h-9 bg-muted/40 border-transparent focus-visible:border-primary/30 focus-visible:bg-white focus-visible:ring-0 text-sm rounded-xl transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="hidden 2xl:flex items-center gap-2">
          <HeaderAction href="/manager/operations" icon={CalendarDays} label="Create Batch" hint="Ops" />
          <HeaderAction href="/manager/operations#attendance" icon={FileSpreadsheet} label="Upload Attendance" hint="Daily" />
          <HeaderAction href="/manager/operations#assessment" icon={FileQuestion} label="Upload Scores" hint="Excel" />
          <HeaderAction href="/manager/reports" icon={BarChart3} label="Reports" hint="Export" />
        </div>
        <Button size="sm" className="h-9 gap-1.5 rounded-xl bg-black text-white hover:bg-black/85 shadow-sm 2xl:hidden" asChild>
          <Link href="/manager/operations">
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">Open Actions</span>
          </Link>
        </Button>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60" asChild>
          <Link href="/manager/docs" title="Admin guide">
            <HelpCircle className="h-4.5 w-4.5" />
          </Link>
        </Button>

        {(profile?.role === 'admin' || profile?.role === 'trainer') && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60">
                <Bell className="h-4.5 w-4.5" />
                {notifications.length > 0 && <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-white" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96 rounded-xl border-border/60 p-2 shadow-xl">
              <div className="flex items-center justify-between px-2 py-2">
                <div>
                  <p className="text-sm font-semibold">Notifications</p>
                  <p className="text-xs text-muted-foreground">Latest activity log</p>
                </div>
                <Button variant="outline" size="sm" className="h-8 rounded-lg" asChild>
                  <Link href="/manager/notifications">View all</Link>
                </Button>
              </div>
              <DropdownMenuSeparator className="my-1" />
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notification records yet.</div>
              ) : notifications.slice(0, 5).map((notification) => (
                <DropdownMenuItem key={notification.id} className="cursor-default rounded-lg p-3 focus:bg-muted/70">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{getNotificationVerb(notification)}</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(notification.created_at).toLocaleString()}</span>
                    </div>
                    <p className="truncate text-sm font-medium">{notification.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 h-9 pl-1.5 pr-3 rounded-xl hover:bg-muted/60 transition-colors">
              <Avatar className="h-7 w-7 ring-2 ring-border">
                <AvatarImage src={(profile as any)?.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-xs font-bold">
                  {profile?.full_name?.charAt(0) || 'M'}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left leading-none">
                <p className="text-[13px] font-semibold text-foreground">{profile?.full_name?.split(' ')[0] || 'Manager'}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Manager</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 hidden md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-xl shadow-xl border-border/60 p-1.5">
            <div className="flex items-center gap-3 px-2 py-2 mb-1">
              <Avatar className="h-10 w-10 ring-2 ring-border">
                <AvatarImage src={(profile as any)?.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white font-bold">
                  {profile?.full_name?.charAt(0) || 'M'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{profile?.full_name || 'Manager'}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1.5">Manager</Badge>
              </div>
            </div>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem className="rounded-lg cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50" asChild>
              <form action={signOut} className="w-full">
                <button type="submit" className="w-full text-left">Sign out</button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

function HeaderAction({ href, icon: Icon, label, hint }: { href: string; icon: any; label: string; hint: string }) {
  return (
    <Link
      href={href}
      className="visible-action inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
    >
      <Icon className="h-4 w-4 text-sky-600" />
      <span>{label}</span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{hint}</span>
    </Link>
  )
}
