import { getVisibleProfiles } from '@/lib/actions/profile'
import { ProfileSearch } from '@/components/profile/profile-search'
import { UsersRound } from 'lucide-react'

export default async function ProfilesPage() {
  const { data: profiles, error } = await getVisibleProfiles()

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <section className="rounded-3xl border border-zinc-900 bg-black p-6 text-white shadow-[0_30px_100px_rgba(0,0,0,0.35)] md:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black">
            <UsersRound className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-500">People Graph</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Profiles</h1>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Search anyone by name, employee ID, email, department, domain, or role. Employee IDs are shown clearly so people with the same name are easy to distinguish.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      ) : (
        <ProfileSearch profiles={profiles || []} />
      )}
    </div>
  )
}
