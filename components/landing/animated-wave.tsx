'use client'

import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

export function AnimatedWave() {
  const waveRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wave = waveRef.current
    if (!wave) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let frame: number | null = null
    const pointer = { x: 0, y: 0 }

    const applyMotion = () => {
      frame = null
      const rect = wave.getBoundingClientRect()
      const center = rect.top + rect.height / 2
      const viewportCenter = window.innerHeight / 2
      const scrollInfluence = Math.max(-1, Math.min(1, (viewportCenter - center) / window.innerHeight))

      wave.style.setProperty('--wave-x', pointer.x.toFixed(3))
      wave.style.setProperty('--wave-y', pointer.y.toFixed(3))
      wave.style.setProperty('--wave-scroll', scrollInfluence.toFixed(3))
    }

    const scheduleMotion = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(applyMotion)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = wave.getBoundingClientRect()
      pointer.x = event.clientX >= rect.left && event.clientX <= rect.right
        ? (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5
        : pointer.x * 0.86
      pointer.y = event.clientY >= rect.top && event.clientY <= rect.bottom
        ? (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5
        : pointer.y * 0.86
      scheduleMotion()
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('scroll', scheduleMotion, { passive: true })
    window.addEventListener('resize', scheduleMotion)
    scheduleMotion()

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('scroll', scheduleMotion)
      window.removeEventListener('resize', scheduleMotion)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div ref={waveRef} className="interactive-wave flex h-full w-full items-center justify-center overflow-hidden">
      <div className="relative grid w-full gap-2 px-2">
        <div className="wave-glow" />
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="wave-track" style={{ '--row': row } as CSSProperties}>
            <span className="wave-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
