'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, UserRound, Fingerprint } from 'lucide-react'
import { getDomainColor } from '@/lib/domain-colors'

type ProfileRow = {
  id: string
  full_name: string | null
  email: string
  employee_id: string | null
  department: string | null
  domain: string | null
  role: string
  avatar_url: string | null
}

export function ProfileSearch({ profiles }: { profiles: ProfileRow[] }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return profiles
    return profiles.filter((profile) =>
      [
        profile.full_name,
        profile.email,
        profile.employee_id,
        profile.department,
        profile.domain,
        profile.role,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    )
  }, [profiles, query])

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, employee ID, email, role, domain, or department"
          className="h-12 rounded-2xl border-zinc-200 bg-white pl-11 shadow-sm"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((profile) => {
          const domainStyle = getDomainColor(profile.domain || profile.department || 'General')
          return (
            <Link
              key={profile.id}
              href={`/profiles/${profile.id}`}
              className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.full_name || profile.email}
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 shrink-0 rounded-2xl border border-zinc-200 bg-white object-cover shadow-md"
                  />
                ) : (
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${domainStyle.gradient} text-sm font-bold text-white shadow-md`}>
                    {profile.full_name?.charAt(0) || profile.email.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold text-zinc-950 group-hover:underline">
                      {profile.full_name || 'Unnamed Profile'}
                    </h2>
                    <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                      {profile.role.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-500">{profile.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                      <Fingerprint className="h-3 w-3" />
                      {profile.employee_id || 'No emp ID'}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${domainStyle.badge}`}>
                      <UserRound className="h-3 w-3" />
                      {profile.domain || profile.department || 'General'}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white py-14 text-center text-sm text-zinc-500">
          No profiles match that search.
        </div>
      )}
    </div>
  )
}
