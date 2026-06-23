'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Users, TrendingUp, Award, type LucideIcon } from 'lucide-react'

interface TrainerMetric {
  id: string
  name: string
  email: string
  batchesCount: number
  attendanceRate: number
  avgScore: number
  avgFeedback: string
  scoreVal: number
}

interface TrainerPerformancePanelProps {
  trainers: TrainerMetric[]
}

type TooltipPayloadItem = {
  name?: string | number
  value?: string | number
  fill?: string
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-lg text-xs text-zinc-900 space-y-1">
      <p className="font-semibold truncate max-w-[160px]">{label}</p>
      {payload.map((item) => (
        <div key={String(item.name)} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: item.fill }} />
          <span className="text-zinc-600">{item.name}:</span>
          <span className="font-bold">{item.value}{item.name !== 'Batches' ? '%' : ''}</span>
        </div>
      ))}
    </div>
  )
}

export function TrainerPerformancePanel({ trainers }: TrainerPerformancePanelProps) {
  if (trainers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
        No trainer data available yet. Assign trainers to batches to populate this panel.
      </div>
    )
  }

  const chartData = trainers.slice(0, 8).map((t) => ({
    name: t.name.split(' ')[0],
    fullName: t.name,
    Attendance: t.attendanceRate,
    Assessment: t.avgScore,
  }))

  const top = trainers[0]
  const bottom = trainers[trainers.length - 1]

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Total trainers"
          value={`${trainers.length}`}
          icon={Users}
          tone="bg-indigo-50 text-indigo-950 border-indigo-100"
        />
        <SummaryCard
          label="Top performer"
          value={top.name.split(' ')[0]}
          sub={`${top.scoreVal.toFixed(0)} score`}
          icon={Award}
          tone="bg-emerald-50 text-emerald-950 border-emerald-100"
        />
        <SummaryCard
          label="Needs coaching"
          value={bottom.name.split(' ')[0]}
          sub={`${bottom.scoreVal.toFixed(0)} score`}
          icon={TrendingUp}
          tone="bg-amber-50 text-amber-950 border-amber-100"
        />
      </div>

      {/* Bar chart */}
      <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 mb-4">Attendance vs assessment average by trainer</p>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="Attendance" radius={[4, 4, 0, 0]} fill="#6366f1" maxBarSize={20} />
              <Bar dataKey="Assessment" radius={[4, 4, 0, 0]} fill="#10b981" maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-indigo-500" />Attendance %</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500" />Assessment Avg %</span>
        </div>
      </div>

      {/* Individual scorecards grid */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {trainers.map((trainer, idx) => {
          const feedbackNum = parseFloat(trainer.avgFeedback)
          const overallColor =
            trainer.scoreVal >= 70 ? 'border-emerald-200 bg-emerald-50/50' :
            trainer.scoreVal >= 50 ? 'border-amber-200 bg-amber-50/50' :
            'border-rose-200 bg-rose-50/50'
          const rankColor =
            idx === 0 ? 'bg-yellow-500 text-white' :
            idx === 1 ? 'bg-zinc-400 text-white' :
            idx === 2 ? 'bg-orange-700 text-white' :
            'bg-zinc-200 text-zinc-700'

          return (
            <div key={trainer.id} className={`rounded-2xl border p-4 shadow-sm ${overallColor}`}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${rankColor}`}>
                      {idx + 1}
                    </span>
                    <p className="font-semibold text-zinc-950 truncate text-sm" title={trainer.name}>{trainer.name}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500 truncate">{trainer.email}</p>
                </div>
                <div className="rounded-full bg-white border border-zinc-200 px-2.5 py-0.5 text-xs font-bold text-zinc-800 shrink-0">
                  {trainer.scoreVal.toFixed(0)}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-center">
                <ScoreChip label="Batches" value={`${trainer.batchesCount}`} />
                <ScoreChip label="Attend" value={`${trainer.attendanceRate}%`}
                  tone={trainer.attendanceRate >= 80 ? 'emerald' : trainer.attendanceRate >= 60 ? 'amber' : 'rose'} />
                <ScoreChip label="Assess" value={`${trainer.avgScore}%`}
                  tone={trainer.avgScore >= 70 ? 'emerald' : trainer.avgScore >= 50 ? 'amber' : 'rose'} />
                <ScoreChip label="Feedback" value={trainer.avgFeedback}
                  tone={feedbackNum >= 4 ? 'emerald' : feedbackNum >= 3 ? 'amber' : 'rose'} />
              </div>

              <StrengthBar attendance={trainer.attendanceRate} assessment={trainer.avgScore} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub, icon: Icon, tone }: {
  label: string; value: string; sub?: string; icon: LucideIcon; tone: string
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider opacity-60 mb-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-2xl font-bold truncate">{value}</p>
      {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
    </div>
  )
}

function ScoreChip({ label, value, tone }: { label: string; value: string; tone?: 'emerald' | 'amber' | 'rose' }) {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
    default: 'bg-zinc-100 text-zinc-700',
  }
  const cls = tone ? tones[tone] : tones.default
  return (
    <div className={`rounded-lg p-1.5 ${cls}`}>
      <p className="text-[9px] uppercase tracking-wider opacity-70 leading-none mb-0.5">{label}</p>
      <p className="text-xs font-bold">{value}</p>
    </div>
  )
}

function StrengthBar({ attendance, assessment }: { attendance: number; assessment: number }) {
  const composite = Math.round((attendance + assessment) / 2)
  const color = composite >= 70 ? '#10b981' : composite >= 50 ? '#f59e0b' : '#f43f5e'
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
        <span>Composite strength</span>
        <span className="font-semibold text-zinc-700">{composite}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/70 border border-white">
        <div className="h-full rounded-full transition-all" style={{ width: `${composite}%`, background: color }} />
      </div>
    </div>
  )
}
