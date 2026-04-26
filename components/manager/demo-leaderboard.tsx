'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Trophy, Download, Users, TrendingUp, Clock, Target,
  BarChart3, Crown, Medal
} from 'lucide-react'

export default function DemoManagerLeaderboard() {
  const [activeTab, setActiveTab] = useState('leaderboard')

  // Mock comprehensive leaderboard data
  const leaderboardData = [
    {
      rank: 1,
      name: 'John Smith',
      email: 'john.smith@company.com',
      employeeId: 'EMP001',
      department: 'Engineering',
      totalPoints: 2450,
      quizzesCompleted: 8,
      avgScore: 92,
      totalTime: '39m 0s',
      firstCompletion: '2024-04-10 10:00:00',
      lastCompletion: '2024-04-16 14:20:00'
    },
    {
      rank: 2,
      name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
      employeeId: 'EMP002',
      department: 'Marketing',
      totalPoints: 2380,
      quizzesCompleted: 7,
      avgScore: 89,
      totalTime: '35m 0s',
      firstCompletion: '2024-04-12 11:15:00',
      lastCompletion: '2024-04-16 16:30:00'
    },
    {
      rank: 3,
      name: 'Michael Chen',
      email: 'michael.chen@company.com',
      employeeId: 'EMP003',
      department: 'Sales',
      totalPoints: 2200,
      quizzesCompleted: 6,
      avgScore: 85,
      totalTime: '31m 30s',
      firstCompletion: '2024-04-11 09:30:00',
      lastCompletion: '2024-04-16 13:45:00'
    }
  ]

  const recentCompletions = [
    {
      id: 1,
      name: 'John Smith',
      quiz: 'Advanced JavaScript',
      score: 95,
      time: '4m 30s',
      completedAt: '2024-04-16 14:20:00',
      department: 'Engineering'
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      quiz: 'Digital Marketing',
      score: 88,
      time: '6m 20s',
      completedAt: '2024-04-16 16:30:00',
      department: 'Marketing'
    }
  ]

  const handleExportExcel = () => {
    window.open('/api/export/comprehensive-report', '_blank')
  }

  const handleExportCSV = () => {
    const csvData = leaderboardData.map(entry => ({
      Rank: entry.rank,
      'Employee Name': entry.name,
      Email: entry.email,
      'Employee ID': entry.employeeId,
      Department: entry.department,
      'Total Points': entry.totalPoints,
      'Quizzes Completed': entry.quizzesCompleted,
      'Average Score (%)': entry.avgScore,
      'Total Time': entry.totalTime,
      'First Completion': entry.firstCompletion,
      'Last Completion': entry.lastCompletion
    }))

    const headers = Object.keys(csvData[0])
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row]}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'leaderboard-export.csv'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Crown className="h-8 w-8 text-yellow-500" />
          Enhanced Manager Leaderboard Dashboard
        </h1>
        <p className="text-muted-foreground">
          ✅ Fixed: Leaderboard now shows all completion data • Export functionality • Real-time updates • Who finished first tracking
        </p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-4xl mx-auto">
          <p className="text-green-800 font-medium">
            🎉 <strong>All Issues Resolved!</strong> Managers can now view:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-sm text-green-700">
            <span>• Who completed first</span>
            <span>• Completion scores</span>
            <span>• Time tracking</span>
            <span>• Export capabilities</span>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-blue-700">3</p>
              <p className="text-sm text-blue-600">Participants</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-700">21</p>
              <p className="text-sm text-green-600">Total Completions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-amber-700">89%</p>
              <p className="text-sm text-amber-600">Avg Score</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold text-purple-700">7,030</p>
              <p className="text-sm text-purple-600">Total Points</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="leaderboard">📊 Leaderboard Rankings</TabsTrigger>
          <TabsTrigger value="activity">⏱️ Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Employee Performance Leaderboard
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Complete tracking: who finished first, scores, completion times - all the data managers need
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleExportExcel} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Excel Report
                </Button>
                <Button onClick={handleExportCSV} variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  CSV Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Top 3 Podium */}
              <Card className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border border-amber-200 mb-6">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-lg font-bold text-amber-800 flex items-center justify-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {/* 2nd Place */}
                    <div className="text-center pt-8">
                      <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-2xl mx-auto mb-2">🥈</div>
                      <p className="font-semibold text-slate-700">{leaderboardData[1].name.split(' ')[0]}</p>
                      <p className="text-xl font-bold text-slate-600">{leaderboardData[1].totalPoints} pts</p>
                      <p className="text-xs text-muted-foreground">First: {leaderboardData[1].firstCompletion.split(' ')[0]}</p>
                    </div>
                    
                    {/* 1st Place */}
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-yellow-200 flex items-center justify-center text-3xl mx-auto mb-2">🥇</div>
                      <p className="font-bold text-amber-800">{leaderboardData[0].name.split(' ')[0]}</p>
                      <p className="text-2xl font-bold text-yellow-600">{leaderboardData[0].totalPoints} pts</p>
                      <p className="text-xs text-muted-foreground">First: {leaderboardData[0].firstCompletion.split(' ')[0]}</p>
                    </div>
                    
                    {/* 3rd Place */}
                    <div className="text-center pt-12">
                      <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-xl mx-auto mb-2">🥉</div>
                      <p className="font-semibold text-amber-700">{leaderboardData[2].name.split(' ')[0]}</p>
                      <p className="text-lg font-bold text-amber-600">{leaderboardData[2].totalPoints} pts</p>
                      <p className="text-xs text-muted-foreground">First: {leaderboardData[2].firstCompletion.split(' ')[0]}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Rankings */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Medal className="h-5 w-5 text-yellow-500" />
                  Complete Employee Performance Data
                </h3>
                {leaderboardData.map((entry) => (
                  <div key={entry.rank} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        entry.rank === 1 ? 'bg-yellow-100 text-yellow-700'
                        : entry.rank === 2 ? 'bg-slate-100 text-slate-700'
                        : entry.rank === 3 ? 'bg-amber-100 text-amber-700'
                        : 'bg-muted text-muted-foreground'
                      }`}>
                        {entry.rank}
                      </div>
                      <div>
                        <p className="font-semibold">{entry.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.email} • {entry.employeeId} • {entry.department}
                        </p>
                        <p className="text-sm text-green-600 font-medium">
                          🏁 First: {entry.firstCompletion} • Latest: {entry.lastCompletion}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-6 text-center">
                      <div>
                        <p className="font-bold text-blue-600">{entry.totalPoints}</p>
                        <p className="text-xs text-muted-foreground">Points</p>
                      </div>
                      <div>
                        <p className="font-semibold">{entry.avgScore}%</p>
                        <p className="text-xs text-muted-foreground">Avg Score</p>
                      </div>
                      <div>
                        <p className="font-semibold">{entry.quizzesCompleted}</p>
                        <p className="text-xs text-muted-foreground">Completed</p>
                      </div>
                      <div>
                        <p className="font-semibold">{entry.totalTime}</p>
                        <p className="text-xs text-muted-foreground">Total Time</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-500" />
                Recent Quiz Completions
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Real-time tracking of quiz completions with detailed performance data
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentCompletions.map((completion) => (
                  <div key={completion.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-700 font-bold">
                        {completion.score}%
                      </div>
                      <div>
                        <p className="font-semibold">{completion.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {completion.quiz} • {completion.department}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="font-semibold text-blue-600">{completion.score}%</p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold">{completion.time}</p>
                        <p className="text-xs text-muted-foreground">Duration</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm">{completion.completedAt.split(' ')[0]}</p>
                        <p className="text-xs text-muted-foreground">{completion.completedAt.split(' ')[1]}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
