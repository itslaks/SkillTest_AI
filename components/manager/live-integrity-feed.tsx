'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { VIOLATION_SEVERITY } from '@/lib/proctoring'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export type LiveIntegrityEvent = {
  id: string
  attemptId: string
  employeeName: string
  quizTitle: string
  type: string
  label: string
  severity: string
  riskScore: number
  occurredAt: string
}

const filters = ['all', 'critical', 'high', 'medium'] as const

export function LiveIntegrityFeed({ initialEvents }: { initialEvents: LiveIntegrityEvent[] }) {
  const [events, setEvents] = useState<LiveIntegrityEvent[]>(initialEvents)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<(typeof filters)[number]>('all')

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('manager-integrity-proctoring-events')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'quiz_proctoring_events',
      }, (payload) => {
        const row = payload.new as any
        const type = String(row.violation_type || '')
        const severity = row.severity || (VIOLATION_SEVERITY as any)[type] || 'medium'
        setEvents((previous) => [{
          id: row.id,
          attemptId: row.attempt_id,
          employeeName: 'Live employee',
          quizTitle: 'Live assessment',
          type,
          label: row.metadata?.label || type.replace(/[-_]/g, ' '),
          severity,
          riskScore: row.risk_score || 0,
          occurredAt: row.occurred_at || new Date().toISOString(),
        }, ...previous].slice(0, 20))
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const visibleEvents = useMemo(() => {
    return events
      .filter((event) => !dismissed.has(event.id))
      .filter((event) => filter === 'all' || event.severity === filter)
      .slice(0, 8)
  }, [dismissed, events, filter])

  return (
    <section className="rounded-2xl border border-red-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-950">Live violation strip</p>
            <p className="text-xs text-red-700">Realtime proctoring events from Supabase.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={filter === item ? 'default' : 'outline'}
              className="h-8 rounded-full capitalize"
              onClick={() => setFilter(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {visibleEvents.length === 0 ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">No live events in this filter.</div>
        ) : visibleEvents.map((event) => (
          <div key={event.id} className="animate-in slide-in-from-right-4 rounded-xl border border-red-300 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-red-950">{event.label}</p>
                  <Badge className={severityClass(event.severity)}>{event.severity}</Badge>
                </div>
                <p className="mt-1 text-xs font-medium text-red-800">
                  {event.employeeName} - {event.quizTitle} - {formatIntegrityTime(event.occurredAt)}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full px-2 text-sm text-red-700 hover:bg-red-50"
                onClick={() => setDismissed((previous) => new Set(previous).add(event.id))}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function formatIntegrityTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function severityClass(severity: string) {
  if (severity === 'critical') return 'bg-red-700 text-white'
  if (severity === 'high') return 'bg-rose-200 text-rose-950'
  if (severity === 'medium') return 'bg-amber-200 text-amber-950'
  return 'bg-zinc-200 text-zinc-900'
}
