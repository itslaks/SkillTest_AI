'use client'

import {
  XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Cell,
  Tooltip, ResponsiveContainer, LabelList,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RetentionCheck, TopicStrengthPoint, TrainerImpactPoint } from '@/lib/types/database'
import { TrendingDown, TrendingUp, Minus, AlertTriangle, ShieldAlert, BarChart2, Target } from 'lucide-react'

interface ScoreBand { range: string; count: number; color: string }
interface TopicPerf { topic: string; avgScore: number; attempts: number }

interface IntelligenceDashboardProps {
  batchProfile: TopicStrengthPoint[]
  trainerImpact: TrainerImpactPoint[]
  retentionChecks: RetentionCheck[]
  antiGamingWatch: Array<{ trainee: string; topic: string; signal: string }>
  scoreDistribution: ScoreBand[]
  topicPerformance: TopicPerf[]
}

// Colour helpers
function scoreColor(score: number): string {
  if (score >= 80) return '#10b981' // emerald
  if (score >= 60) return '#3b82f6' // blue
  if (score >= 40) return '#f59e0b' // amber
  return '#ef4444'                  // red
}

function scoreBadgeCls(score: number): string {
  if (score >= 80) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (score >= 60) return 'border-blue-200 bg-blue-50 text-blue-700'
  if (score >= 40) return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-rose-200 bg-rose-50 text-rose-700'
}

// Custom tooltip for bar charts
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-800">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color || p.fill }} className="mt-0.5">
          {p.name}: <span className="font-bold">{p.value}</span>
          {p.dataKey === 'avgScore' ? '%' : ''}
        </p>
      ))}
    </div>
  )
}

export function IntelligenceDashboard({
  trainerImpact,
  retentionChecks,
  antiGamingWatch,
  scoreDistribution,
  topicPerformance,
}: IntelligenceDashboardProps) {

  const totalAttempts = scoreDistribution.reduce((s, b) => s + b.count, 0)
  const passCount = scoreDistribution.filter(b => ['61–80', '81–100'].includes(b.range)).reduce((s, b) => s + b.count, 0)
  const passRate = totalAttempts > 0 ? Math.round((passCount / totalAttempts) * 100) : 0

  return (
    <div className="space-y-5">

      {/* Row 1: Score Distribution + Topic Performance */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Score Distribution */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart2 className="h-4 w-4 text-blue-500" />
                  Score Distribution
                </CardTitle>
                <CardDescription className="mt-1">
                  Attempt counts across 5 score bands — {totalAttempts} total completed
                </CardDescription>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-bold" style={{ color: scoreColor(passRate) }}>{passRate}%</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pass rate</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {totalAttempts === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
                No completed attempts yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={scoreDistribution} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="range" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar dataKey="count" name="Attempts" radius={[8, 8, 0, 0]} maxBarSize={52}>
                      {scoreDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                      <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 600, fill: '#475569' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {scoreDistribution.map((b) => (
                    <div key={b.range} className="flex items-center gap-1.5 rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />
                      <span className="text-[10px] font-semibold text-slate-600">{b.range}: {b.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Topic Performance */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-violet-500" />
              Topic Performance
            </CardTitle>
            <CardDescription className="mt-1">
              Average score per quiz topic — colour = performance tier
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            {topicPerformance.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
                No topic data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={topicPerformance.length > 4 ? 220 : 180}>
                <BarChart
                  data={topicPerformance}
                  layout="vertical"
                  margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} unit="%" />
                  <YAxis type="category" dataKey="topic" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#475569' }} width={90} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="avgScore" name="Avg Score" radius={[0, 8, 8, 0]} maxBarSize={22}>
                    {topicPerformance.map((entry, i) => (
                      <Cell key={i} fill={scoreColor(entry.avgScore)} />
                    ))}
                    <LabelList dataKey="avgScore" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fontWeight: 600, fill: '#475569' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Trainer Impact + Knowledge Decay + Anti-Gaming */}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">

        {/* Trainer Impact */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trainer Impact Score</CardTitle>
            <CardDescription>Outcome-linked topic performance per trainer</CardDescription>
          </CardHeader>
          <CardContent>
            {trainerImpact.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-400">
                No trainer data yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trainerImpact.slice(0, 6)} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="trainerName" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} unit="%" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar dataKey="impactScore" name="Impact Score" radius={[8, 8, 0, 0]} maxBarSize={44}>
                      {trainerImpact.slice(0, 6).map((entry, i) => (
                        <Cell key={i} fill={scoreColor(entry.averageScore)} />
                      ))}
                      <LabelList dataKey="impactScore" position="top" formatter={(v: number) => `${v}`} style={{ fontSize: 10, fontWeight: 600, fill: '#475569' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Score tier legend */}
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {[
                    { label: '≥ 80 Excellent', color: '#10b981' },
                    { label: '60–79 Good', color: '#3b82f6' },
                    { label: '40–59 Fair', color: '#f59e0b' },
                    { label: '< 40 Needs attention', color: '#ef4444' },
                  ].map((t) => (
                    <div key={t.label} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} />
                      <span className="text-[10px] text-slate-500">{t.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Knowledge Decay */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              Knowledge Decay
            </CardTitle>
            <CardDescription>Topics nearing the 2-week retention threshold</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {retentionChecks.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-emerald-100 bg-emerald-50 text-sm text-emerald-600">
                <div className="text-center">
                  <TrendingUp className="mx-auto mb-1.5 h-5 w-5" />
                  No decay risks detected
                </div>
              </div>
            ) : retentionChecks.slice(0, 5).map((item) => {
              const isCritical = item.status === 'critical'
              const isWatch = item.status === 'watch'
              const statusCls = isCritical
                ? 'border-rose-200 bg-rose-50'
                : isWatch
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-emerald-200 bg-emerald-50'
              const badgeCls = isCritical
                ? 'border-rose-300 bg-rose-100 text-rose-700'
                : isWatch
                  ? 'border-amber-300 bg-amber-100 text-amber-700'
                  : 'border-emerald-300 bg-emerald-100 text-emerald-700'
              const DecayIcon = isCritical ? AlertTriangle : isWatch ? Minus : TrendingUp
              return (
                <div key={item.topic} className={`rounded-2xl border p-3.5 ${statusCls}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.topic}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.daysSinceLastAssessment}d since last assessment</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 capitalize text-[10px] ${badgeCls}`}>
                      <DecayIcon className="mr-1 h-3 w-3" />
                      {item.status}
                    </Badge>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-1 text-center text-[10px]">
                    <div className="rounded-lg bg-white/70 px-1.5 py-1.5">
                      <p className="font-bold text-slate-800">{item.baselineScore}%</p>
                      <p className="text-slate-400">Baseline</p>
                    </div>
                    <div className="rounded-lg bg-white/70 px-1.5 py-1.5">
                      <p className="font-bold text-slate-800">{item.latestScore}%</p>
                      <p className="text-slate-400">Latest</p>
                    </div>
                    <div className={`rounded-lg px-1.5 py-1.5 ${item.decayDelta < 0 ? 'bg-rose-100' : 'bg-emerald-100'}`}>
                      <p className={`font-bold ${item.decayDelta < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{item.decayDelta > 0 ? '+' : ''}{item.decayDelta}%</p>
                      <p className="text-slate-400">Δ Decay</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Anti-Gaming Watchlist */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              Anti-Gaming Watchlist
            </CardTitle>
            <CardDescription>Fast-perfect repetition patterns flagged by AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {antiGamingWatch.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-emerald-100 bg-emerald-50 text-sm text-emerald-600">
                <div className="text-center">
                  <ShieldAlert className="mx-auto mb-1.5 h-5 w-5" />
                  No patterns detected
                </div>
              </div>
            ) : antiGamingWatch.map((item, i) => (
              <div key={`${item.trainee}-${i}`} className="rounded-2xl border border-rose-100 bg-rose-50 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.trainee}</p>
                  <Badge variant="outline" className="shrink-0 border-rose-200 bg-white text-[10px] text-rose-600">
                    Flagged
                  </Badge>
                </div>
                <p className="mt-1 text-xs font-medium text-rose-600">{item.topic}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{item.signal}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
