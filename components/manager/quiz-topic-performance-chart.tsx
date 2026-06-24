'use client'

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type QuestionPerformance = {
  label: string
  questionText: string
  correctRate: number
  wrongRate: number
  attempts: number
}

export function QuizTopicPerformanceChart({
  topic,
  totalAttempts,
  data,
}: {
  topic: string
  totalAttempts: number
  data: QuestionPerformance[]
}) {
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
        Topic performance will appear after employees complete this quiz.
      </div>
    )
  }

  const topicAverage = Math.round(data.reduce((sum, item) => sum + item.correctRate, 0) / data.length)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Topic" value={topic || 'General'} />
        <Metric label="Completed attempts" value={`${totalAttempts}`} />
        <Metric label="Topic accuracy" value={`${topicAverage}%`} tone={topicAverage >= 70 ? 'good' : topicAverage >= 50 ? 'warn' : 'risk'} />
      </div>
      <div className="h-72 rounded-2xl border border-zinc-200 bg-white p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'rgba(15,23,42,0.05)' }}
              formatter={(value: number, name: string) => [`${value}%`, name === 'correctRate' ? 'Correct' : 'Wrong']}
              labelFormatter={(label) => {
                const item = data.find((row) => row.label === label)
                return item ? `${label}: ${item.questionText}` : String(label)
              }}
            />
            <Bar dataKey="correctRate" radius={[6, 6, 0, 0]} name="Correct">
              {data.map((item) => (
                <Cell key={item.label} fill={item.correctRate >= 70 ? '#16a34a' : item.correctRate >= 50 ? '#d97706' : '#dc2626'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {data
          .filter((item) => item.wrongRate > 25)
          .map((item) => (
            <div key={item.label} className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <p className="font-semibold">{item.label}: {item.wrongRate}% wrong</p>
              <p className="mt-1 line-clamp-2 text-rose-800">{item.questionText}</p>
            </div>
          ))}
      </div>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' | 'risk' }) {
  const color = tone === 'good'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : tone === 'risk'
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : 'border-zinc-200 bg-zinc-50 text-zinc-800'
  return (
    <div className={`rounded-2xl border p-3 ${color}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-1 truncate text-lg font-bold" title={value}>{value}</p>
    </div>
  )
}
