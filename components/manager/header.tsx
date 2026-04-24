'use client'

import { Bell, Search, Plus, ChevronDown, HelpCircle, FileQuestion, Users, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Profile } from '@/lib/types/database'
import { signOut } from '@/lib/actions/auth'
import { useRouter } from 'next/navigation'

interface ManagerHeaderProps {
  profile: Profile | null
}

export function ManagerHeader({ profile }: ManagerHeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/50 bg-white/98 backdrop-blur-md px-4 md:px-6">
      <div className="flex-1 flex items-center gap-3">
        <div className="hidden xl:flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700">
          <HelpCircle className="h-3.5 w-3.5" />
          Tip: Start with Create, then Assign, then Analytics
        </div>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-9 gap-1.5 rounded-xl bg-black text-white hover:bg-black/85 shadow-sm hidden sm:flex">
              <Plus className="h-4 w-4" />
              <span className="text-sm font-medium">Create</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-xl border-border/60">
            <DropdownMenuItem onClick={() => router.push('/manager/quizzes/new')} className="rounded-lg cursor-pointer gap-2 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <FileQuestion className="h-3.5 w-3.5 text-violet-600" />
              </div>
              New Quiz
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/manager/employees')} className="rounded-lg cursor-pointer gap-2 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              Import Employees
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/manager/analytics')} className="rounded-lg cursor-pointer gap-2 py-2.5">
              <div className="w-7 h-7 rounded-lg bg-pink-100 flex items-center justify-center">
                <Brain className="h-3.5 w-3.5 text-pink-600" />
              </div>
              AI Analysis
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60">
          <HelpCircle className="h-4.5 w-4.5" />
        </Button>

        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60">
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-white" />
        </Button>

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
