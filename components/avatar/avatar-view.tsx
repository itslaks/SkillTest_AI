'use client'

import Image from 'next/image'
import type React from 'react'
import { UserRound } from 'lucide-react'
import { Avatar3D } from '@/components/avatar/avatar-3d'
import { getAvatar3DId } from '@/lib/avatar-options'

/**
 * Neutral "no avatar" placeholder. Avatars are optional — users who have not
 * picked one get this instead of a forced default preset.
 */
export function AvatarPlaceholder({
  size = 48,
  className,
  label = 'No avatar selected',
}: {
  size?: number
  className?: string
  label?: string
}) {
  const radius = Math.max(12, Math.round(size * 0.28))
  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex items-center justify-center bg-gradient-to-b from-zinc-100 to-zinc-200 text-zinc-400 shadow-sm ${className || ''}`}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <UserRound aria-hidden="true" style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  )
}

export function AvatarView({
  src,
  alt,
  size = 48,
  fallback,
  className,
  interactive = false,
  priority = false,
}: {
  src?: string | null
  alt: string
  size?: number
  fallback?: React.ReactNode
  className?: string
  interactive?: boolean
  priority?: boolean
}) {
  const avatarId = getAvatar3DId(src)

  // A chosen 3D preset (current or legacy-mapped id).
  if (avatarId) {
    return <Avatar3D avatarId={avatarId} size={size} className={className} interactive={interactive} priority={priority} />
  }

  // Custom uploaded photo or external URL.
  if (src && !src.startsWith('avatar3d:')) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        unoptimized
        className={className}
      />
    )
  }

  // No avatar chosen (or an unrecognized preset id): caller fallback, else
  // the neutral placeholder. Avatars are optional by design.
  if (fallback) return <>{fallback}</>
  return <AvatarPlaceholder size={size} className={className} label={alt} />
}
