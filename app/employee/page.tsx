import { getEmployeeStats, getAvailableQuizzes } from '@/lib/actions/employee'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  Trophy, Flame, Target, Star, ArrowRight, FileQuestion, Clock, Zap,
} from 'lucide-react'

export default async function EmployeeDashboard() {
  const { data: stats } = await getEmployeeStats()
  const { data: quizzes } = await getAvailableQuizzes()

  const activeQuizzes = quizzes?.filter((q: any) => !q.attemptStatus || q.attemptStatus === 'in_progress') || []
  const completedQuizzes = quizzes?.filter((q: any) => q.attemptStatus === 'completed') || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Track your progress and take quizzes.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Points</CardTitle>
            <Star className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.stats?.total_points || 0}</div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Streak</CardTitle>
            <Flame className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.stats?.current_streak || 0} <span className="text-base font-normal text-muted-foreground">days</span></div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/5 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quizzes Done</CardTitle>
            <Target className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.stats?.tests_completed || 0}</div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-bl-full" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Score</CardTitle>
            <Trophy className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Math.round(stats?.stats?.average_score || 0)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      {stats?.badges && stats.badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Your Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {stats.badges.map((ub: any) => (
                <div key={ub.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border">
                  <span className="text-lg">🏆</span>
                  <div>
                    <p className="text-sm font-medium">{ub.badges?.name}</p>
                    <p className="text-xs text-muted-foreground">{ub.badges?.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Quizzes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Available Quizzes</CardTitle>
            <CardDescription>Take a quiz to earn points and badges</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/employee/quizzes">
              View All <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {activeQuizzes.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeQuizzes.slice(0, 6).map((quiz: any) => (
                <div key={quiz.id} className="flex flex-col p-4 rounded-lg border hover:border-primary/50 transition-colors">
                  <h3 className="font-medium truncate">{quiz.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{quiz.description || quiz.topic}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="secondary" className="text-xs">{quiz.difficulty}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {quiz.time_limit_minutes}m
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileQuestion className="h-3 w-3" /> {quiz.questions?.[0]?.count || quiz.question_count} Q
                    </span>
                  </div>
                  <Button size="sm" className="mt-3" asChild>
                    <Link href={`/employee/quizzes/${quiz.id}`}>
                      {quiz.attemptStatus === 'in_progress' ? 'Continue' : 'Start Quiz'}
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No quizzes available right now</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Attempts */}
      {stats?.recentAttempts && stats.recentAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentAttempts.slice(0, 5).map((attempt: any) => (
                <div key={attempt.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{attempt.quizzes?.title}</p>
                    <p className="text-xs text-muted-foreground">{attempt.quizzes?.topic}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${attempt.score >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                      {attempt.score}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Math.floor(attempt.time_taken_seconds / 60)}m {attempt.time_taken_seconds % 60}s
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
