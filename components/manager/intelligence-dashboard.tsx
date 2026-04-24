'use client'

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, XAxis, YAxis, CartesianGrid, BarChart, Bar, Cell } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { RetentionCheck, TopicStrengthPoint, TrainerImpactPoint } from '@/lib/types/database'

interface IntelligenceDashboardProps {
  batchProfile: TopicStrengthPoint[]
  trainerImpact: TrainerImpactPoint[]
  retentionChecks: RetentionCheck[]
  antiGamingWatch: Array<{ trainee: string; topic: string; signal: string }>
}

const chartConfig = {
  score: { label: 'Score', color: '#111111' },
  impactScore: { label: 'Impact', color: '#111111' },
  daysSinceLastAssessment: { label: 'Days', color: '#111111' },
}

export function IntelligenceDashboard({
  batchProfile,
  trainerImpact,
  retentionChecks,
  antiGamingWatch,
}: IntelligenceDashboardProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card className="border-zinc-800 bg-black text-white shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
        <CardHeader>
          <CardTitle>Batch DNA Fingerprint</CardTitle>
          <CardDescription className="text-zinc-400">
            Collective strengths and blind spots across current quiz topics.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[340px]">
          <ChartContainer config={chartConfig} className="h-full w-full text-white">
            <RadarChart data={batchProfile.slice(0, 6)}>
              <ChartTooltip content={<ChartTooltipContent />} />
              <PolarGrid stroke="rgba(255,255,255,0.15)" />
              <PolarAngleAxis dataKey="topic" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <Radar dataKey="score" stroke="#ffffff" fill="#ffffff" fillOpacity={0.18} />
            </RadarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-zinc-200 bg-white text-black">
          <CardHeader>
            <CardTitle>Trainer Impact Score</CardTitle>
            <CardDescription>
              Outcome-linked topic performance by trainer.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[220px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart data={trainerImpact.slice(0, 6)} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="trainerName" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="impactScore" radius={[12, 12, 0, 0]}>
                  {trainerImpact.slice(0, 6).map((entry) => (
                    <Cell key={`${entry.trainerId}-${entry.topic}`} fill={entry.averageScore >= 70 ? '#111111' : '#767676'} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 bg-zinc-50 text-black">
          <CardHeader>
            <CardTitle>Knowledge Decay Tracker</CardTitle>
            <CardDescription>Topics approaching or beyond the 2-week retention threshold.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {retentionChecks.length > 0 ? retentionChecks.slice(0, 4).map((item) => (
              <div key={item.topic} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.topic}</p>
                    <p className="text-xs text-zinc-500">
                      {item.daysSinceLastAssessment} day(s) since last assessment
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.status === 'critical' ? 'bg-black text-white' :
                    item.status === 'watch' ? 'bg-zinc-200 text-zinc-900' :
                    'bg-zinc-100 text-zinc-700'
                  }`}>
                    {item.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span>Baseline {item.baselineScore}%</span>
                  <span>Latest {item.latestScore}%</span>
                  <span>Decay {item.decayDelta}%</span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-zinc-500">No retention risks detected yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-black text-white">
          <CardHeader>
            <CardTitle>Anti-Gaming Watchlist</CardTitle>
            <CardDescription className="text-zinc-400">
              Fast-perfect repetition patterns that may indicate memorization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {antiGamingWatch.length > 0 ? antiGamingWatch.map((item, index) => (
              <div key={`${item.trainee}-${item.topic}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold">{item.trainee}</p>
                <p className="mt-1 text-sm text-zinc-300">{item.topic}</p>
                <p className="mt-2 text-xs text-zinc-400">{item.signal}</p>
              </div>
            )) : (
              <p className="text-sm text-zinc-400">No memorization anti-patterns detected.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
