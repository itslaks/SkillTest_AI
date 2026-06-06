'use client'

import { useRouter } from 'next/navigation'
import type { ComponentProps, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type SafeBackButtonProps = {
  fallbackHref: string
  children: ReactNode
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  className?: string
}

export function SafeBackButton({
  fallbackHref,
  children,
  variant = 'ghost',
  size,
  className,
}: SafeBackButtonProps) {
  const router = useRouter()

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back()
          return
        }
        router.push(fallbackHref)
      }}
    >
      {children}
    </Button>
  )
}
