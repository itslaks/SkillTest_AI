import { getAllBadges } from '@/lib/actions/employee'
import {
  Award,
  BookOpen,
  Crown,
  Flame,
  Lock,
  Medal,
  Rocket,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'

const iconMap: Record<string, any> = {
  rocket: Rocket,
  trophy: Trophy,
  zap: Zap,
  flame: Flame,
  fire: Flame,
  'book-open': BookOpen,
  award: Award,
  crown: Crown,
  target: Target,
  medal: Medal,
  shield: ShieldCheck,
  trending: TrendingUp,
}

export default async function BadgesPage() {
  const { data: badges } = await getAllBadges()

  const earned = badges?.filter((badge: any) => badge.earned) || []
  const locked = badges?.filter((badge: any) => !badge.earned) || []
  const categories = [...new Set((badges || []).map((badge: any) => badge.category || 'General'))]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Badges</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Earn badges by completing quizzes, answering well, attending daily, and keeping momentum.
            {earned.length > 0 && ` You've earned ${earned.length} of ${badges?.length || 0}.`}
          </p>
        </div>
        {earned.length > 0 && (
          <div className="rounded-xl border border-pink-200 bg-white px-4 py-2 text-sm font-semibold text-pink-700 shadow-sm">
            {earned.length} Earned
          </div>
        )}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.slice(0, 16).map((category) => (
            <span key={category} className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm">
              {category}
            </span>
          ))}
        </div>
      )}

      {earned.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Earned Badges
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {earned.map((badge: any) => (
              <BadgeCard key={badge.id} badge={badge} earned />
            ))}
          </div>
        </section>
      )}

      {locked.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            <Lock className="h-3 w-3" />
            Locked - Keep going
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((badge: any) => (
              <BadgeCard key={badge.id} badge={badge} earned={false} />
            ))}
          </div>
        </section>
      )}

      {earned.length === 0 && locked.length === 0 && (
        <div className="rounded-2xl border border-border/60 bg-white py-16 text-center shadow-sm">
          <Award className="mx-auto mb-4 h-14 w-14 text-muted-foreground/30" />
          <h3 className="mb-1 font-semibold">No Badges Yet</h3>
          <p className="text-sm text-muted-foreground">Start taking quizzes to earn your first badge.</p>
        </div>
      )}
    </div>
  )
}

function BadgeCard({ badge, earned }: { badge: any; earned: boolean }) {
  const IconComp = iconMap[badge.icon] || Award
  const style = getBadgeStyle(badge)

  return (
    <div
      className={`relative flex items-start gap-4 overflow-hidden border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
        earned ? style.border : `${style.border} border-dashed opacity-60 hover:opacity-80`
      } ${style.shape}`}
    >
      {earned && <div className={`pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-bl-full opacity-20 ${style.glow}`} />}
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center ${style.iconShape} ${earned ? style.gradient : 'bg-muted'}`}>
        <IconComp className={`h-6 w-6 ${earned ? 'text-white' : 'text-muted-foreground'}`} />
      </div>
      <div className="relative z-10 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={`font-bold ${earned ? 'text-zinc-950' : 'text-muted-foreground'}`}>{badge.name}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${earned ? style.pill : 'bg-muted text-muted-foreground'}`}>
            {badge.rarity || 'common'}
          </span>
        </div>
        <p className={`mt-1 text-xs ${earned ? 'text-zinc-600' : 'text-muted-foreground/70'}`}>{badge.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${earned ? style.pill : 'bg-muted text-muted-foreground'}`}>
            +{badge.points} pts
          </span>
          <span className="text-xs text-zinc-400">{badge.category || 'General'}</span>
        </div>
      </div>
    </div>
  )
}

function getBadgeStyle(badge: any) {
  const colorMap: Record<string, { gradient: string; border: string; glow: string; pill: string }> = {
    emerald: { gradient: 'bg-gradient-to-br from-emerald-500 to-teal-600', border: 'border-emerald-200', glow: 'bg-emerald-400', pill: 'bg-emerald-100 text-emerald-700' },
    sky: { gradient: 'bg-gradient-to-br from-sky-500 to-blue-600', border: 'border-sky-200', glow: 'bg-sky-400', pill: 'bg-sky-100 text-sky-700' },
    amber: { gradient: 'bg-gradient-to-br from-amber-500 to-orange-600', border: 'border-amber-200', glow: 'bg-amber-400', pill: 'bg-amber-100 text-amber-700' },
    rose: { gradient: 'bg-gradient-to-br from-rose-500 to-pink-600', border: 'border-rose-200', glow: 'bg-rose-400', pill: 'bg-rose-100 text-rose-700' },
    violet: { gradient: 'bg-gradient-to-br from-violet-500 to-fuchsia-600', border: 'border-violet-200', glow: 'bg-violet-400', pill: 'bg-violet-100 text-violet-700' },
    cyan: { gradient: 'bg-gradient-to-br from-cyan-500 to-slate-700', border: 'border-cyan-200', glow: 'bg-cyan-400', pill: 'bg-cyan-100 text-cyan-700' },
    lime: { gradient: 'bg-gradient-to-br from-lime-500 to-emerald-600', border: 'border-lime-200', glow: 'bg-lime-400', pill: 'bg-lime-100 text-lime-700' },
    indigo: { gradient: 'bg-gradient-to-br from-indigo-500 to-blue-700', border: 'border-indigo-200', glow: 'bg-indigo-400', pill: 'bg-indigo-100 text-indigo-700' },
    fuchsia: { gradient: 'bg-gradient-to-br from-fuchsia-500 to-purple-700', border: 'border-fuchsia-200', glow: 'bg-fuchsia-400', pill: 'bg-fuchsia-100 text-fuchsia-700' },
    teal: { gradient: 'bg-gradient-to-br from-teal-500 to-cyan-700', border: 'border-teal-200', glow: 'bg-teal-400', pill: 'bg-teal-100 text-teal-700' },
    red: { gradient: 'bg-gradient-to-br from-red-500 to-rose-700', border: 'border-red-200', glow: 'bg-red-400', pill: 'bg-red-100 text-red-700' },
    zinc: { gradient: 'bg-gradient-to-br from-zinc-700 to-black', border: 'border-zinc-200', glow: 'bg-zinc-400', pill: 'bg-zinc-100 text-zinc-700' },
  }
  const shapeMap: Record<string, { card: string; icon: string }> = {
    rounded: { card: 'rounded-2xl', icon: 'rounded-xl' },
    pill: { card: 'rounded-[2rem]', icon: 'rounded-full' },
    shield: { card: 'rounded-t-3xl rounded-b-xl', icon: 'rounded-t-2xl rounded-b-md' },
    diamond: { card: 'rounded-xl', icon: 'rotate-45 rounded-lg' },
    hex: { card: 'rounded-3xl', icon: 'rounded-[1.35rem]' },
    ticket: { card: 'rounded-lg', icon: 'rounded-md' },
  }
  const colors = colorMap[badge.color || 'zinc'] || colorMap.zinc
  const shape = shapeMap[badge.shape || 'rounded'] || shapeMap.rounded
  return {
    ...colors,
    shape: shape.card,
    iconShape: shape.icon,
  }
}
