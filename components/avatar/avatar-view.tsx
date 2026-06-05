'use client'

import Image from 'next/image'
import type React from 'react'
import { Avatar3D } from '@/components/avatar/avatar-3d'
import { getAvatar3DId } from '@/lib/avatar-options'

export function AvatarView({
  src,
  alt,
  size = 48,
  fallback,
  className,
  interactive = false,
}: {
  src?: string | null
  alt: string
  size?: number
  fallback?: React.ReactNode
  className?: string
  interactive?: boolean
}) {
  const avatarId = getAvatar3DId(src)

  if (avatarId) {
    return <Avatar3D avatarId={avatarId} size={size} className={className} interactive={interactive} />
  }

  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        unoptimized
        className={className}
      />
    )
  }

  return <>{fallback}</>
}
