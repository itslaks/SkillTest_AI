import { createAdminClient } from '@/lib/supabase/server'
import { requireTrainingStaff } from '@/lib/rbac'
import { ManagerSidebar } from '@/components/manager/sidebar'
import { ManagerHeader } from '@/components/manager/header'
import { redirect } from 'next/navigation'

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId, role } = await requireTrainingStaff()

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  // Admin visiting /manager root → go to admin console
  // (This is handled in signIn, but just in case someone navigates directly)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ManagerSidebar profile={profile} />
      <div className="relative z-10 transition-[margin-left] duration-200 ease-out lg:ml-[var(--manager-sidebar-width,16rem)]">
        <ManagerHeader profile={profile} />
        <main className="mx-auto max-w-[1600px] overflow-x-hidden p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
