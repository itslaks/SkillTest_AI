'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface FeedbackSentimentChartProps {
  positive: number
  neutral: number
  negative: number
  total: number
  avgRating: string
  avgContent: string
  avgTrainer: string
}

const SENTIMENT_COLORS = {
  Positive: '#10b981',
  Neutral: '#3b82f6',
  Negative: '#f43f5e',
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 shadow-lg">
      <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: item.payload.fill }} />
      {item.name}: <strong>{item.value}</strong> ({item.payload.pct}%)
    </div>
  )
}

function CustomLegend({ positive, neutral, negative, total }: { positive: number; neutral: number; negative: number; total: number }) {
  const items = [
    { label: 'Positive', value: positive, color: SENTIMENT_COLORS.Positive },
    { label: 'Neutral', value: neutral, color: SENTIMENT_COLORS.Neutral },
    { label: 'Negative', value: negative, color: SENTIMENT_COLORS.Negative },
  ]
  return (
    <div className="flex flex-col justify-center gap-2">
      {items.map((item) => {
        const pct = total ? Math.round((item.value / total) * 100) : 0
        return (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
            <span className="w-14 text-zinc-600">{item.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
            </div>
            <span className="w-8 text-right font-semibold text-zinc-800">{item.value}</span>
          </div>
        )
      })}
    </div>
  )
}

export function FeedbackSentimentChart({
  positive,
  neutral,
  negative,
  total,
  avgRating,
  avgContent,
  avgTrainer,
}: FeedbackSentimentChartProps) {
  const hasData = positive > 0 || neutral > 0 || negative > 0
  const data = hasData
    ? [
        { name: 'Positive', value: positive, pct: total ? Math.round((positive / total) * 100) : 0, fill: SENTIMENT_COLORS.Positive },
        { name: 'Neutral', value: neutral, pct: total ? Math.round((neutral / total) * 100) : 0, fill: SENTIMENT_COLORS.Neutral },
        { name: 'Negative', value: negative, pct: total ? Math.round((negative / total) * 100) : 0, fill: SENTIMENT_COLORS.Negative },
      ].filter((d) => d.value > 0)
    : [{ name: 'No data', value: 1, pct: 100, fill: '#e4e4e7' }]

  const positivePct = total ? Math.round((positive / total) * 100) : 0

  return (
    <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Feedback sentiment</p>
          <p className="mt-1 text-sm text-zinc-500">{total} response{total !== 1 ? 's' : ''} collected</p>
        </div>
        {hasData && (
          <div className={`rounded-full px-3 py-1 text-xs font-bold ${
            positivePct >= 70 ? 'bg-emerald-100 text-emerald-800' :
            positivePct >= 50 ? 'bg-amber-100 text-amber-800' :
            'bg-rose-100 text-rose-800'
          }`}>
            {positivePct}% positive
          </div>
        )}
      </div>

      <div className="grid grid-cols-[120px_1fr] items-center gap-4">
        <div className="relative h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={32}
                outerRadius={52}
                paddingAngle={hasData ? 3 : 0}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {hasData && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xl font-bold leading-none text-zinc-950">{total}</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">total</p>
            </div>
          )}
        </div>
        <CustomLegend positive={positive} neutral={neutral} negative={negative} total={total} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-100 pt-4">
        <RatingChip label="Avg rating" value={avgRating} />
        <RatingChip label="Content" value={avgContent} />
        <RatingChip label="Trainer" value={avgTrainer} />
      </div>
    </div>
  )
}

function RatingChip({ label, value }: { label: string; value: string }) {
  const num = parseFloat(value)
  const color = num >= 4 ? 'text-emerald-700' : num >= 3 ? 'text-amber-700' : 'text-rose-700'
  return (
    <div className="rounded-xl bg-zinc-50 p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}
