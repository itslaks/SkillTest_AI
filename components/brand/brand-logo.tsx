import Image from 'next/image'
import { cn } from '@/lib/utils'

type BrandLogoVariant = 'full' | 'mark'
type BrandLogoTone = 'light' | 'dark'

interface BrandLogoProps {
  variant?: BrandLogoVariant
  tone?: BrandLogoTone
  className?: string
  imageClassName?: string
  priority?: boolean
}

const logoAsset = {
  full: {
    src: '/brand/skilltest-ai-logo.webp',
    width: 900,
    height: 263,
  },
  mark: {
    src: '/brand/skilltest-ai-mark.png',
    width: 512,
    height: 512,
  },
}

export function BrandLogo({
  variant = 'full',
  tone = 'dark',
  className,
  imageClassName,
  priority,
}: BrandLogoProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center',
        tone === 'dark' && 'rounded-md bg-slate-950/95 p-1.5',
        className
      )}
    >
      <Image
        src={logoAsset[variant].src}
        alt="SkillTest_AI"
        width={logoAsset[variant].width}
        height={logoAsset[variant].height}
        className={cn('block h-auto w-full object-contain', imageClassName)}
        draggable={false}
        priority={priority}
      />
    </span>
  )
}
