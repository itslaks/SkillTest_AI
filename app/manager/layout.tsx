import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ManagerSidebar } from '@/components/manager/sidebar'
import { ManagerHeader } from '@/components/manager/header'

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  const role = user.user_metadata?.role
  if (role !== 'manager' && role !== 'admin') {
    redirect('/employee')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-background">
      <ManagerSidebar profile={profile} />
      <div className="lg:pl-64">
        <ManagerHeader profile={profile} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
