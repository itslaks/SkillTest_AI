'use client'

import { useEffect } from 'react'

export type ViolationToastItem = {
  id: string
  type: string
  label: string
}

const icons: Record<string, string> = {
  multiple_faces: '👥',
  'multiple-faces': '👥',
  phone_detected: '📱',
  'phone-detected': '📱',
  gaze_down: '👇',
  gaze_away: '↩️',
  'gaze-away': '↩️',
  electronic_device: '💻',
  book_detected: '📖',
  no_face: '🚫',
  'no-face': '🚫',
  face_substitution: '🪪',
}

export function ViolationToast({
  items,
  onDismiss,
}: {
  items: ViolationToastItem[]
  onDismiss: (id: string) => void
}) {
  return (
    <div className="fixed bottom-5 right-5 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
      {items.slice(0, 3).map((item) => (
        <ViolationToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ViolationToastCard({
  item,
  onDismiss,
}: {
  item: ViolationToastItem
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(item.id), 5200)
    return () => window.clearTimeout(timeout)
  }, [item.id, onDismiss])

  return (
    <div className="animate-in slide-in-from-right-8 overflow-hidden rounded-xl border border-red-200/40 bg-gradient-to-br from-red-700 via-rose-700 to-red-950 text-white shadow-2xl">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none">{icons[item.type] || '⚠️'}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-5">{item.label}</p>
            <p className="mt-1 text-xs text-red-100">Captured and reported to examiner.</p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            className="rounded-full px-2 text-lg leading-none text-white/75 hover:bg-white/10 hover:text-white"
            aria-label="Dismiss violation alert"
          >
            ×
          </button>
        </div>
      </div>
      <div className="h-1 origin-left animate-[toast-progress_5.2s_linear_forwards] bg-white/80" />
    </div>
  )
}
