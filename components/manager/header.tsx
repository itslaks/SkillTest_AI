'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, Search, Plus, HelpCircle, FileQuestion, CalendarDays, FileSpreadsheet, BarChart3, ChevronDown, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Profile } from '@/lib/types/database'
import { getNotificationVerb, type StaffNotification } from '@/lib/notifications'
import { LogoutForm } from '@/components/auth/logout-form'
import { Avatar3D } from '@/components/avatar/avatar-3d'
import { getAvatar3DId } from '@/lib/avatar-options'
import { createClient } from '@/lib/supabase/client'

interface ManagerHeaderProps {
  profile: Profile | null
  notifications?: StaffNotification[]
}

export function ManagerHeader({ profile, notifications = [] }: ManagerHeaderProps) {
  const avatarId = getAvatar3DId((profile as any)?.avatar_url)
  const [liveNotifications, setLiveNotifications] = useState<StaffNotification[]>(notifications)
  const unreadCount = useMemo(() => liveNotifications.filter((item) => item.is_read !== true).length, [liveNotifications])

  useEffect(() => {
    setLiveNotifications(notifications)
  }, [notifications])

  useEffect(() => {
    if (!profile || !['admin', 'trainer'].includes(profile.role)) return
    const supabase = createClient()
    const channel = supabase
      .channel(`manager-notification-bell-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'training_notifications',
      }, (payload) => {
        const row = payload.new as any
        if (row.recipient_user_id && row.recipient_user_id !== profile.id && profile.role !== 'admin') return
        setLiveNotifications((previous) => [{
          id: row.id,
          title: row.title,
          message: row.message,
          audience: row.audience,
          channel: row.channel,
          delivery_status: row.delivery_status,
          created_at: row.created_at,
          sent_at: row.sent_at,
          scheduled_for: row.scheduled_for,
          is_read: row.is_read,
          metadata: row.metadata,
        }, ...previous].slice(0, 20))
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [profile])

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
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-1 ring-white">
                    {Math.min(99, unreadCount)}
                  </span>
                )}
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
              {liveNotifications.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notification records yet.</div>
              ) : liveNotifications.slice(0, 5).map((notification) => (
                <DropdownMenuItem key={notification.id} className="cursor-default rounded-lg p-3 focus:bg-muted/70">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        {notification.metadata?.category === 'proctoring_alert' ? '🚨 Alert' : getNotificationVerb(notification)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(notification.created_at).toLocaleString()}</span>
                    </div>
                    <p className="flex items-center gap-1 truncate text-sm font-medium">
                      {notification.metadata?.category === 'proctoring_alert' && <ShieldAlert className="h-3.5 w-3.5 text-red-600" />}
                      {notification.title}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                    {notification.metadata?.category === 'proctoring_alert' && (
                      <Link href="/manager/integrity" className="mt-2 inline-flex text-xs font-semibold text-red-700 hover:underline">
                        Open Integrity
                      </Link>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 h-9 pl-1.5 pr-3 rounded-xl hover:bg-muted/60 transition-colors">
              {avatarId ? (
                <Avatar3D avatarId={avatarId} size={28} className="ring-2 ring-border" />
              ) : (
                <Avatar className="h-7 w-7 ring-2 ring-border">
                  <AvatarImage src={(profile as any)?.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-xs font-bold">{profile?.full_name?.charAt(0) || 'M'}</AvatarFallback>
                </Avatar>
              )}
              <div className="hidden md:block text-left leading-none">
                <p className="text-[13px] font-semibold text-foreground">{profile?.full_name?.split(' ')[0] || 'Manager'}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Manager</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 hidden md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-xl shadow-xl border-border/60 p-1.5">
            <div className="flex items-center gap-3 px-2 py-2 mb-1">
              {avatarId ? (
                <Avatar3D avatarId={avatarId} size={40} className="ring-2 ring-border" />
              ) : (
                <Avatar className="h-10 w-10 ring-2 ring-border">
                  <AvatarImage src={(profile as any)?.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white font-bold">{profile?.full_name?.charAt(0) || 'M'}</AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{profile?.full_name || 'Manager'}</p>
                <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1.5">Manager</Badge>
              </div>
            </div>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem className="rounded-lg cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50" asChild>
              <LogoutForm className="w-full">
                <button type="submit" className="w-full text-left">Sign out</button>
              </LogoutForm>
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
