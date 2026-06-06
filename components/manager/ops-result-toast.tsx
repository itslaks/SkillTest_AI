'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle } from 'lucide-react'

export function OpsResultToast() {
  const params = useSearchParams()
  const status = params.get('ops_status')
  const error = params.get('ops_error')
  const [visible, setVisible] = useState(Boolean(status || error))

  useEffect(() => {
    setVisible(Boolean(status || error))
    if (!(status || error)) return
    const timer = window.setTimeout(() => setVisible(false), 9000)
    return () => window.clearTimeout(timer)
  }, [status, error])

  if (!visible || !(status || error)) return null

  const isError = Boolean(error)
  const Icon = isError ? XCircle : CheckCircle2

  return (
    <div className="fixed right-5 top-5 z-[80] max-w-md animate-in fade-in slide-in-from-top-2">
      <div className={`rounded-2xl border p-4 shadow-[0_18px_60px_rgba(0,0,0,0.2)] ${
        isError
          ? 'border-rose-200 bg-rose-50 text-rose-900'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900'
      }`}>
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">{isError ? 'Action needs review' : 'Action completed'}</p>
            <p className="mt-1 text-sm leading-5">{error || status}</p>
          </div>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="ml-2 rounded-full px-2 text-lg leading-none opacity-60 hover:opacity-100"
            aria-label="Dismiss message"
          >
            x
          </button>
        </div>
      </div>
    </div>
  )
}
