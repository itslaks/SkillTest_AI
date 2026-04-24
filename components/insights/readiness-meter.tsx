import { cn } from '@/lib/utils'
import type { ReadinessInsight } from '@/lib/types/database'

interface ReadinessMeterProps {
  readiness: ReadinessInsight
  compact?: boolean
  className?: string
}

export function ReadinessMeter({ readiness, compact = false, className }: ReadinessMeterProps) {
  const tone =
    readiness.status === 'ready'
      ? 'border-white/20 bg-white text-black'
      : readiness.status === 'focus'
        ? 'border-white/15 bg-zinc-900 text-white'
        : 'border-white/10 bg-black text-white'

  return (
    <div className={cn('rounded-[1.75rem] border p-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)]', tone, className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className={cn('text-[10px] uppercase tracking-[0.3em]', compact ? 'opacity-60' : 'opacity-70')}>
            Readiness Meter
          </p>
          <p className="mt-2 text-3xl font-semibold leading-none">{readiness.score}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.3em] opacity-60">Predicted</p>
          <p className="mt-2 text-xl font-medium">{readiness.predictedScore}%</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            readiness.status === 'ready' ? 'bg-black' : 'bg-white'
          )}
          style={{ width: `${readiness.score}%` }}
        />
      </div>

      {!compact && (
        <p className={cn('mt-3 text-sm leading-relaxed', readiness.status === 'ready' ? 'text-black/70' : 'text-white/70')}>
          {readiness.recommendation}
        </p>
      )}
    </div>
  )
}
