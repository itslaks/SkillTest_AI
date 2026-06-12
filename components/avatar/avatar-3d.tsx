'use client'

import Image from 'next/image'
import { CheckCircle2 } from 'lucide-react'
import {
  AVATAR_3D_LIBRARY,
  AVATAR_3D_IDS,
  getAvatar3DAsset,
  getAvatar3DMeta,
  type Avatar3DId,
} from '@/lib/avatar-options'

export function Avatar3D({
  avatarId = 'm1',
  size = 80,
  className,
  interactive = false,
  priority = false,
}: {
  avatarId?: Avatar3DId | string | null
  size?: number
  className?: string
  interactive?: boolean
  priority?: boolean
}) {
  const meta = getAvatar3DMeta(avatarId)
  const radius = Math.max(12, Math.round(size * 0.24))

  return (
    <Image
      src={getAvatar3DAsset(meta.id)}
      alt={`${meta.name} 3D Memoji avatar`}
      width={size}
      height={size}
      priority={priority}
      loading={priority ? 'eager' : 'lazy'}
      sizes={`${size}px`}
      className={`bg-white object-cover shadow-sm ${interactive ? 'transition-transform duration-300 hover:-translate-y-0.5 hover:scale-[1.03]' : ''} ${className || ''}`}
      style={{ width: size, height: size, borderRadius: radius }}
    />
  )
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value?: Avatar3DId | null
  onChange: (id: Avatar3DId) => void
}) {
  const groups = [
    { label: 'Professional', ids: AVATAR_3D_LIBRARY.filter((item) => item.group === 'Professional').map((item) => item.id) },
    { label: 'Creative', ids: AVATAR_3D_LIBRARY.filter((item) => item.group === 'Creative').map((item) => item.id) },
  ]

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.label} className="space-y-2" aria-label={`${group.label} avatar presets`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{group.label} presets</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {group.ids.map((id) => {
              const meta = getAvatar3DMeta(id)
              const selected = value === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange(id)}
                  aria-label={`Choose ${meta.name} avatar`}
                  aria-pressed={selected}
                  title={meta.name}
                  className={`group relative rounded-2xl border bg-white p-2 text-left shadow-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                    selected
                      ? 'border-blue-600 ring-2 ring-blue-600/20'
                      : 'border-zinc-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md'
                  }`}
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-50">
                    <Image
                      src={getAvatar3DAsset(id)}
                      alt={`${meta.name} avatar preview`}
                      fill
                      loading="lazy"
                      sizes="(max-width: 640px) 44vw, (max-width: 1024px) 20vw, 96px"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  </div>
                  <span className="mt-2 block truncate text-xs font-semibold text-zinc-800">{meta.name}</span>
                  {selected && (
                    <span className="absolute right-2 top-2 rounded-full bg-blue-600 p-1 text-white shadow-sm">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export const AVATAR_3D_DEFS = AVATAR_3D_IDS.map(getAvatar3DMeta)
