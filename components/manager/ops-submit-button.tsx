'use client'

import { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function OpsSubmitButton({
  children,
  pendingLabel = 'Working...',
  className,
  variant,
  size,
}: {
  children: ReactNode
  pendingLabel?: string
  className?: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} variant={variant} size={size} className={className}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingLabel}
        </>
      ) : children}
    </Button>
  )
}
