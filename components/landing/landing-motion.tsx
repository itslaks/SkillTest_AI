'use client'

import { useEffect, useRef } from 'react'

const revealSelector = [
  '.landing-motion-root section > div',
  '.landing-motion-root article',
  '.landing-motion-root .signal-card',
  '.landing-motion-root .helper-strip',
  '.landing-motion-root .glass-panel',
  '.landing-motion-root .maverick-rail-card',
].join(', ')

export function LandingMotion() {
  const frameRef = useRef<number | null>(null)
  const pointerRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.landing-motion-root')
    if (!root) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>(revealSelector))

    revealTargets.forEach((target, index) => {
      target.dataset.landingReveal = 'true'
      target.style.setProperty('--reveal-delay', `${Math.min(index % 8, 6) * 55}ms`)
    })

    if (prefersReducedMotion) {
      revealTargets.forEach((target) => {
        target.dataset.visible = 'true'
      })
      root.style.setProperty('--landing-scroll', '0')
      root.style.setProperty('--landing-scroll-px', '0px')
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const target = entry.target as HTMLElement
          target.dataset.visible = 'true'
          observer.unobserve(target)
        })
      },
      { rootMargin: '0px 0px -14% 0px', threshold: 0.16 },
    )

    revealTargets.forEach((target) => observer.observe(target))

    const applyMotion = () => {
      frameRef.current = null
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
      const scrollProgress = Math.min(window.scrollY / maxScroll, 1)

      root.style.setProperty('--mouse-x', pointerRef.current.x.toFixed(3))
      root.style.setProperty('--mouse-y', pointerRef.current.y.toFixed(3))
      root.style.setProperty('--landing-scroll', scrollProgress.toFixed(4))
      root.style.setProperty('--landing-scroll-px', `${Math.round(window.scrollY * 0.08)}px`)
    }

    const scheduleMotion = () => {
      if (frameRef.current !== null) return
      frameRef.current = window.requestAnimationFrame(applyMotion)
    }

    const handlePointerMove = (event: PointerEvent) => {
      pointerRef.current = {
        x: event.clientX / window.innerWidth - 0.5,
        y: event.clientY / window.innerHeight - 0.5,
      }
      scheduleMotion()
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('scroll', scheduleMotion, { passive: true })
    window.addEventListener('resize', scheduleMotion)
    scheduleMotion()

    return () => {
      observer.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('scroll', scheduleMotion)
      window.removeEventListener('resize', scheduleMotion)
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-[3px] origin-left scale-x-[var(--landing-scroll,0)] bg-gradient-to-r from-cyan-400 via-blue-500 to-amber-300 shadow-[0_0_24px_rgba(14,165,233,0.42)]"
      aria-hidden="true"
    />
  )
}
