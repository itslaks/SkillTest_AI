'use client'

import Image from 'next/image'
import type React from 'react'
import { Avatar3D } from '@/components/avatar/avatar-3d'
import { AVATAR_3D_PREFIX, getAvatar3DId, getSafeAvatar3DId } from '@/lib/avatar-options'

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

  if (avatarId) {
    return <Avatar3D avatarId={avatarId} size={size} className={className} interactive={interactive} priority={priority} />
  }

  if (!src || src.startsWith(AVATAR_3D_PREFIX)) {
    return <Avatar3D avatarId={getSafeAvatar3DId(src)} size={size} className={className} interactive={interactive} priority={priority} />
  }

  if (src) {
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

  return <>{fallback}</>
}
