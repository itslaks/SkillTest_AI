'use client'

import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'

interface AiLearnRecommendProps {
  stats: any
  quizzes: any[]
  retentionRisk?: any
}

/**
 * Employee-side AI coaching widget.
 * Calls /api/ai-recommend on mount with compact stats — max 150 tokens server-side.
 */
export function AiLearnRecommend({ stats, quizzes, retentionRisk }: AiLearnRecommendProps) {
  const [recommendation, setRecommendation] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function fetch_recommendation() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats, quizzes: quizzes.slice(0, 5), retentionRisk }),
      })
      const json = await res.json()
      if (res.ok) setRecommendation(json.recommendation)
    } catch {
      // fail silently
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch_recommendation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!recommendation && !loading) return null

  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">
          <Sparkles className="h-3.5 w-3.5" />
          Maverick Coach
        </div>
        <button
          onClick={fetch_recommendation}
          disabled={loading}
          className="text-violet-400 hover:text-violet-600 disabled:opacity-40 transition-colors"
          title="Get new recommendation"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-3 w-full rounded bg-violet-100 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-violet-100 animate-pulse" />
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-violet-900">{recommendation}</p>
      )}
    </div>
  )
}
