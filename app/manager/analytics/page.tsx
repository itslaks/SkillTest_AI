import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { 
  ArrowLeft, BarChart3, FileSpreadsheet, MessageSquare, 
  TrendingUp, Users, Trophy, Target 
} from 'lucide-react'
import { AssessmentAnalyzer } from '@/components/manager/assessment-analyzer'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/auth/login')
  }

  // Verify manager role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'manager' && profile.role !== 'admin')) {
    redirect('/employee')
  }

  // Get quizzes for selection
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, title, topic')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  // Get import history
  const { data: importHistory } = await supabase
    .from('assessment_imports')
    .select('*')
    .eq('uploaded_by', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Get overall stats
  const { data: overallStats } = await supabase
    .from('quiz_attempts')
    .select('score, correct_answers, total_questions, time_taken_seconds, quizzes!inner(created_by)')
    .eq('quizzes.created_by', user.id)
    .eq('status', 'completed')

  const totalAttempts = overallStats?.length || 0
  const avgScore = totalAttempts > 0
    ? Math.round((overallStats?.reduce((a, b) => a + (b.score || 0), 0) || 0) / totalAttempts)
    : 0
  const totalCorrect = overallStats?.reduce((a, b) => a + (b.correct_answers || 0), 0) || 0
  const totalQuestions = overallStats?.reduce((a, b) => a + (b.total_questions || 0), 0) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/manager"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Analytics & AI Insights
          </h1>
          <p className="text-muted-foreground">
            Upload assessment data, analyze results, and get AI-powered insights
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
              <Target className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAttempts}</p>
              <p className="text-xs text-muted-foreground">Total Attempts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-green-600">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgScore}%</p>
              <p className="text-xs text-muted-foreground">Average Score</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCorrect}/{totalQuestions}</p>
              <p className="text-xs text-muted-foreground">Correct Answers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold">{importHistory?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Data Imports</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assessment Analyzer */}
      <AssessmentAnalyzer />

      {/* Import History */}
      {importHistory && importHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Recent Imports
            </CardTitle>
            <CardDescription>Your assessment data import history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {importHistory.map((imp: any) => (
                <div key={imp.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{imp.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(imp.created_at).toLocaleDateString()} • {imp.total_records} records
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      imp.status === 'completed' ? 'bg-green-100 text-green-700' :
                      imp.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {imp.status}
                    </span>
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
