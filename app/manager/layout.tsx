import { createAdminClient } from '@/lib/supabase/server'
import { requireTrainingStaff } from '@/lib/rbac'
import { ManagerSidebar } from '@/components/manager/sidebar'
import { ManagerHeader } from '@/components/manager/header'
import { ManagerCommandChatbot } from '@/components/manager/manager-command-chatbot'
import Link from 'next/link'
import {
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  MessageSquareText,
  Download,
  FileCheck2,
} from 'lucide-react'

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await requireTrainingStaff()

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return (
    <div className="min-h-screen bg-background text-foreground maverick-ops-shell">
      <ManagerSidebar profile={profile} />
      <div className="relative z-10 transition-[margin-left] duration-200 ease-out lg:ml-[var(--manager-sidebar-width,16rem)]">
        <ManagerHeader profile={profile} />
        {/* Command strip — terminal-style quick actions */}
        <div className="border-b border-zinc-900/10 bg-zinc-950 px-4 py-2 md:px-6">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 overflow-x-auto">
            <div className="terminal-badge shrink-0">CMD</div>
            <div className="h-4 w-px bg-white/10 shrink-0" />
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <CmdAction href="/manager/operations" label="New Batch" icon={CalendarDays} />
              <CmdAction href="/manager/operations#attendance" label="Attendance" icon={ClipboardCheck} />
              <CmdAction href="/manager/operations#assessment" label="Scores" icon={FileSpreadsheet} />
              <CmdAction href="/manager/operations#feedback" label="Feedback" icon={MessageSquareText} />
              <CmdAction href="/manager/compliance" label="BRD Proof" icon={FileCheck2} />
              <CmdAction href="/manager/reports" label="Reports" icon={Download} />
            </div>
            <div className="ml-auto hidden xl:flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">LIVE</span>
            </div>
          </div>
        </div>
        <main className="mx-auto max-w-[1600px] overflow-x-hidden p-4 md:p-8">
          {children}
        </main>
      </div>
      <ManagerCommandChatbot />
    </div>
  )
}

function CmdAction({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white transition-all"
    >
      <Icon className="h-3 w-3" />
      {label}
    </Link>
  )
}
