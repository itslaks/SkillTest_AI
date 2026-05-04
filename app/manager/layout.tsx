import { createAdminClient } from '@/lib/supabase/server'
import { requireTrainingStaff } from '@/lib/rbac'
import { ManagerSidebar } from '@/components/manager/sidebar'
import { ManagerHeader } from '@/components/manager/header'
import Link from 'next/link'

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

  // Admin visiting /manager root goes to admin console.
  // (This is handled in signIn, but just in case someone navigates directly)

  return (
    <div className="min-h-screen bg-background text-foreground maverick-ops-shell">
      <ManagerSidebar profile={profile} />
      <div className="relative z-10 transition-[margin-left] duration-200 ease-out lg:ml-[var(--manager-sidebar-width,16rem)]">
        <ManagerHeader profile={profile} />
        <div className="border-b border-slate-200 bg-white/95 px-4 py-3 md:px-6">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <p className="text-sm font-semibold text-slate-900">Quick actions for daily training work</p>
            <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
              <QuickAction href="/manager/operations" label="Create / Edit Batch" hint="Start here" />
              <QuickAction href="/manager/operations#attendance" label="Mark Attendance" hint="Daily" />
              <QuickAction href="/manager/operations#assessment" label="Upload Scores" hint="Excel" />
              <QuickAction href="/manager/operations#feedback" label="Send Feedback" hint="Email" />
              <QuickAction href="/manager/reports" label="Download Reports" hint="Excel/PDF" />
            </div>
          </div>
        </div>
        <main className="mx-auto max-w-[1600px] overflow-x-hidden p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function QuickAction({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link href={href} className="visible-action inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
      <span>{label}</span>
      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">{hint}</span>
    </Link>
  )
}
