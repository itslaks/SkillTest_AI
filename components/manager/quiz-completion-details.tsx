'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Clock, Trophy, Target, Download, Calendar,
  User, CheckCircle2, BarChart3
} from 'lucide-react'

interface QuizCompletionEntry {
  id: string
  user_id: string
  score: number
  correct_answers: number
  total_questions: number
  time_taken_seconds: number
  points_earned: number
  completed_at: string
  quiz: {
    title: string
    topic: string
    difficulty: string
  }
  profile: {
    full_name: string
    email: string
    employee_id: string | null
    department: string | null
  }
}

interface QuizCompletionDetailsProps {
  completions: QuizCompletionEntry[]
  quizTitle?: string
  exportHref?: string
}

export function QuizCompletionDetails({ 
  completions, 
  quizTitle,
  exportHref,
}: QuizCompletionDetailsProps) {
  const formatTime = (seconds: number) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 80) return 'text-blue-600 bg-blue-50 border-blue-200'
    if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const difficultyColors: Record<string, string> = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-blue-100 text-blue-700',
    hard: 'bg-amber-100 text-amber-700',
    advanced: 'bg-orange-100 text-orange-700',
    hardcore: 'bg-red-100 text-red-700',
  }

  // Get stats
  const avgScore = completions.length > 0 
    ? Math.round(completions.reduce((sum, c) => sum + c.score, 0) / completions.length)
    : 0
  
  const avgTime = completions.length > 0 
    ? Math.round(completions.reduce((sum, c) => sum + c.time_taken_seconds, 0) / completions.length)
    : 0

  const topPerformer = completions.length > 0 
    ? completions.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.time_taken_seconds - b.time_taken_seconds
      })[0]
    : null

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {completions.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 bg-blue-500 rounded-xl">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{completions.length}</p>
                <p className="text-xs text-blue-600/70 font-medium">Completions</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 bg-green-500 rounded-xl">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">{avgScore}%</p>
                <p className="text-xs text-green-600/70 font-medium">Avg Score</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 rounded-xl">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{formatTime(avgTime)}</p>
                <p className="text-xs text-amber-600/70 font-medium">Avg Time</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 border-purple-100">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 bg-purple-500 rounded-xl">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-purple-700 truncate">
                  {topPerformer?.profile.full_name?.split(' ')[0] || 'N/A'}
                </p>
                <p className="text-xs text-purple-600/70 font-medium">Top Scorer</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Results */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              {quizTitle ? `${quizTitle} - Completion Details` : 'Quiz Completion Details'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Showing who completed {quizTitle ? 'this quiz' : 'quizzes'} and their performance
            </p>
          </div>
          {exportHref && completions.length > 0 && (
            <Button asChild variant="outline" size="sm">
              <a href={exportHref}>
              <Download className="mr-2 h-4 w-4" />
              Export Results
              </a>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {completions.length > 0 ? (
            <div className="space-y-3">
              {completions.map((completion) => {
                const { date, time } = formatDate(completion.completed_at)
                const scoreColor = getScoreColor(completion.score)
                
                return (
                  <div
                    key={completion.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold border-2 ${scoreColor}`}>
                        {completion.score}%
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{completion.profile.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {completion.profile.email} • {completion.profile.employee_id || 'No ID'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {completion.profile.department || 'No Department'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span className="font-semibold">{completion.correct_answers}</span>
                          <span className="text-muted-foreground">/{completion.total_questions}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Correct</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-blue-500" />
                          <span className="font-semibold">{formatTime(completion.time_taken_seconds)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Duration</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <Trophy className="h-3 w-3 text-yellow-500" />
                          <span className="font-semibold">{completion.points_earned}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Points</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-gray-500" />
                          <div>
                            <p className="font-semibold text-xs">{date}</p>
                            <p className="text-xs text-muted-foreground">{time}</p>
                          </div>
                        </div>
                      </div>

                      {completion.quiz && (
                        <div className="text-center">
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${difficultyColors[completion.quiz.difficulty] || ''}`}
                          >
                            {completion.quiz.difficulty}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1 max-w-20 truncate">
                            {completion.quiz.title}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Completions Yet</h3>
              <p className="text-muted-foreground">
                Quiz completions will appear here once employees finish taking quizzes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
