import { getUserProfile } from '@/lib/actions/auth'
import { getVisibleProfiles } from '@/lib/actions/profile'
import { ProfileForm } from '@/components/manager/profile-form'
import { ProfileSearch } from '@/components/profile/profile-search'
import { redirect } from 'next/navigation'

export default async function ProfileSettingsPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/auth/login')
  const { data: profiles } = await getVisibleProfiles()

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 py-8 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update your photo, domain, department, and display name.</p>
      </div>
      <ProfileForm profile={profile} />
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">People Search</h2>
          <p className="mt-1 text-sm text-muted-foreground">Find colleagues and view their public learning profile.</p>
        </div>
        <ProfileSearch profiles={profiles || []} />
      </section>
    </div>
  )
}
