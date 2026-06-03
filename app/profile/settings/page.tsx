import { getUserProfile } from '@/lib/actions/auth'
import { ProfileForm } from '@/components/manager/profile-form'
import { redirect } from 'next/navigation'

export default async function ProfileSettingsPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/auth/login')

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 py-8 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update your photo, domain, department, and display name.</p>
      </div>
      <ProfileForm profile={profile} />
    </div>
  )
}
