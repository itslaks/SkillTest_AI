'use client'

import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import type { InsightType } from '@/lib/backend/entities/ai.entity'

interface AiInsightCardProps {
  type: InsightType
  data: unknown
  /** Optional label shown above the insight */
  label?: string
  className?: string
}

/**
 * Lightweight AI insight card.
 * Calls /api/ai-insight on mount; shows a spinner while loading.
 * Caps response at 200 tokens server-side for minimal cost per render.
 */
export function AiInsightCard({ type, data, label, className = '' }: AiInsightCardProps) {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetch_insight() {
    if (!data) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setInsight(json.insight)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load AI insight')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch_insight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) return null // AI is optional enrichment.

  return (
    <div className={`rounded-2xl border border-violet-100 bg-violet-50 p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">
          <Sparkles className="h-3.5 w-3.5" />
          {label ?? 'AI Insight'}
        </div>
        <button
          onClick={fetch_insight}
          disabled={loading}
          className="text-violet-400 hover:text-violet-600 disabled:opacity-40 transition-colors"
          title="Refresh insight"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-3 w-full rounded bg-violet-100 animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-violet-100 animate-pulse" />
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-violet-900">{insight}</p>
      )}
    </div>
  )
}

