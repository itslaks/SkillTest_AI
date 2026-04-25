import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { requireManager } from '@/lib/rbac'
import { ManagerSidebar } from '@/components/manager/sidebar'
import { ManagerHeader } from '@/components/manager/header'

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await requireManager()

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return (
    <div className="min-h-screen bg-background text-foreground noise-overlay">
      <ManagerSidebar profile={profile} />
      <div className="relative z-10 transition-[padding-left] duration-200 ease-out lg:pl-[var(--manager-sidebar-width,16rem)]">
        <ManagerHeader profile={profile} />
        <main className="mx-auto max-w-[1600px] overflow-x-hidden p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
