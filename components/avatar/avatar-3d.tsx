'use client'

import Image from 'next/image'
import { Check } from 'lucide-react'
import {
  AVATAR_3D_IDS,
  AVATAR_3D_LIBRARY,
  getAvatar3DAsset,
  getAvatar3DMeta,
  DEFAULT_AVATAR_3D_ID,
  type Avatar3DId,
} from '@/lib/avatar-options'

/**
 * Renders a 3D memoji-style avatar head.
 * Assets are transparent-background heads, so we always use object-contain
 * (never crop a face) over a soft gradient backdrop.
 */
export function Avatar3D({
  avatarId = DEFAULT_AVATAR_3D_ID,
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
  const radius = Math.max(12, Math.round(size * 0.28))

  return (
    <Image
      src={getAvatar3DAsset(meta.id)}
      alt={meta.alt}
      width={size}
      height={size}
      priority={priority}
      loading={priority ? 'eager' : 'lazy'}
      sizes={`${size}px`}
      className={`bg-gradient-to-b from-sky-50 via-white to-indigo-100 object-contain shadow-sm ${interactive ? 'transition-transform duration-300 hover:-translate-y-0.5 hover:scale-[1.03]' : ''} ${className || ''}`}
      style={{ width: size, height: size, borderRadius: radius, padding: Math.max(2, Math.round(size * 0.06)) }}
    />
  )
}

/**
 * Keyboard-accessible avatar selection grid: one clean grid, the image is the
 * focus (labels are screen-reader only). Selected tile shows a ring + check.
 */
export function AvatarPicker({
  value,
  onChange,
}: {
  value?: Avatar3DId | null
  onChange: (id: Avatar3DId) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="3D avatar presets"
      className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"
    >
      {AVATAR_3D_LIBRARY.map((meta) => {
        const selected = value === meta.id
        return (
          <button
            key={meta.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(meta.id)}
            aria-label={meta.alt}
            title={meta.name}
            className={`group relative aspect-square overflow-hidden rounded-2xl border bg-gradient-to-b from-sky-50 via-white to-indigo-100 p-1.5 outline-none transition-all focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
              selected
                ? 'border-blue-600 ring-2 ring-blue-600/25 shadow-md'
                : 'border-zinc-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md'
            }`}
          >
            <Image
              src={getAvatar3DAsset(meta.id)}
              alt=""
              aria-hidden="true"
              fill
              loading="lazy"
              sizes="(max-width: 640px) 22vw, (max-width: 1024px) 15vw, 88px"
              className="object-contain p-1.5 transition-transform duration-300 group-hover:scale-[1.06]"
            />
            {selected && (
              <span className="absolute right-1 top-1 rounded-full bg-blue-600 p-0.5 text-white shadow-sm">
                <Check className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={3} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export const AVATAR_3D_DEFS = AVATAR_3D_IDS.map(getAvatar3DMeta)
