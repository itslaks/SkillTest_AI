import { getAllBadges } from '@/lib/actions/employee'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Award, Lock, Rocket, Trophy, Zap, Flame, BookOpen, Crown } from 'lucide-react'

const iconMap: Record<string, any> = {
  rocket: Rocket,
  trophy: Trophy,
  zap: Zap,
  flame: Flame,
  fire: Flame,
  'book-open': BookOpen,
  award: Award,
  crown: Crown,
}

export default async function BadgesPage() {
  const { data: badges } = await getAllBadges()

  const earned = badges?.filter((b: any) => b.earned) || []
  const locked = badges?.filter((b: any) => !b.earned) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Award className="h-8 w-8 text-purple-500" />
          Badges
        </h1>
        <p className="text-muted-foreground">
          Earn badges by completing quizzes and building streaks.
          {earned.length > 0 && ` You've earned ${earned.length} badge${earned.length > 1 ? 's' : ''}!`}
        </p>
      </div>

      {/* Earned Badges */}
      {earned.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">🏆 Earned</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {earned.map((badge: any) => {
              const IconComp = iconMap[badge.icon] || Award
              return (
                <Card key={badge.id} className="relative overflow-hidden border-primary/20 bg-primary/5">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-bl-full" />
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <IconComp className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{badge.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{badge.description}</p>
                      <p className="text-xs text-primary font-medium mt-2">+{badge.points} points</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {/* Locked Badges */}
      {locked.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Locked
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((badge: any) => {
              const IconComp = iconMap[badge.icon] || Award
              return (
                <Card key={badge.id} className="opacity-60">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <IconComp className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{badge.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{badge.description}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-2">+{badge.points} points</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
