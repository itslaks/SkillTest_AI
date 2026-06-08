'use client'

import dynamic from 'next/dynamic'

const HeroVisual3D = dynamic(() => import('./HeroVisual3D').then((mod) => mod.HeroVisual3D), {
  ssr: false,
  loading: () => <div className="min-h-[430px] rounded-[1.75rem] bg-slate-950 sm:min-h-[540px] lg:min-h-[620px]" />,
})

export function HeroShowcase() {
  return (
    <HeroVisual3D />
  );
}
