'use client'

import { cn } from '@/lib/utils'

interface MonochromeOrbProps {
  className?: string
}

export function MonochromeOrb({ className }: MonochromeOrbProps) {
  return (
    <div className={cn('pointer-events-none relative h-40 w-40 [perspective:1200px]', className)}>
      <div className="absolute inset-0 animate-[float_7s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.95),rgba(180,180,180,0.4)_35%,rgba(20,20,20,0.9)_72%,rgba(0,0,0,1))] shadow-[inset_-20px_-30px_60px_rgba(0,0,0,0.65),0_24px_80px_rgba(0,0,0,0.45)]" />
      <div className="absolute inset-[12%] rounded-full border border-white/20 [transform:translateZ(60px)]" />
      <div className="absolute inset-[22%] rounded-full border border-white/10 [transform:translateZ(120px)]" />
      <div className="absolute left-[18%] top-[16%] h-10 w-10 rounded-full bg-white/60 blur-md" />
    </div>
  )
}
