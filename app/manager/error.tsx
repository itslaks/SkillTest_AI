'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ManagerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="rounded-[2rem] border border-rose-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose-600">Manager workspace</p>
      <h1 className="mt-3 text-2xl font-semibold text-zinc-950">This view could not load cleanly.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
        The operation was stopped before the dashboard could render. Retry the request, and the app will rebuild the current view with fresh data.
      </p>
      <Button onClick={reset} className="mt-5 rounded-full">Retry view</Button>
    </div>
  )
}
