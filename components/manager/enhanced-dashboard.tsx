'use client'

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Users, 
  BookOpen, 
  TrendingUp, 
  Clock, 
  Target,
  Plus,
  Edit,
  BarChart3,
  Calendar,
  Award,
  Settings
} from "lucide-react"

interface Quiz {
  id: string
  title: string
  description?: string
  is_active: boolean
  created_at: string
  questions_count: number
  attempts_count: number
  avg_score: number
}

interface Employee {
  id: string
  full_name: string
  email: string
  department?: string
  domain?: string
  total_points: number
  tests_completed: number
  current_streak: number
}

interface DashboardStats {
  totalEmployees: number
  totalQuizzes: number
  activeQuizzes: number
  avgCompletionRate: number
  totalAttempts: number
  avgScore: number
}

interface EnhancedDashboardProps {
  stats: DashboardStats
  recentQuizzes: Quiz[]
  topEmployees: Employee[]
  onCreateQuiz?: () => void
  onAddEmployee?: () => void
}

export function EnhancedDashboard({
  stats,
  recentQuizzes,
  topEmployees,
  onCreateQuiz,
  onAddEmployee
}: EnhancedDashboardProps) {
  const [selectedTab, setSelectedTab] = useState("overview")

  return (
    <div className="space-y-6">
      {/* Quick Action Bar */}
      <div className="flex flex-wrap gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border">
        <Button 
          onClick={onCreateQuiz}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Quiz
        </Button>
        <Button 
          variant="outline"
          onClick={onAddEmployee}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          View Reports
        </Button>
        <Button variant="outline" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              Active team members
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Quizzes</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeQuizzes}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalQuizzes - stats.activeQuizzes} in draft
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgCompletionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Quiz completion rate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgScore}%</div>
            <p className="text-xs text-muted-foreground">
              Across all attempts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quizzes">Recent Quizzes</TabsTrigger>
          <TabsTrigger value="employees">Top Performers</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Common management tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule Quiz Assignment
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Generate Performance Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="mr-2 h-4 w-4" />
                  Bulk Import Employees
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Health</CardTitle>
                <CardDescription>Current system status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Quiz Engine</span>
                  <Badge className="bg-green-100 text-green-800">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">User Authentication</span>
                  <Badge className="bg-green-100 text-green-800">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Data Sync</span>
                  <Badge className="bg-green-100 text-green-800">Operational</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quizzes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Quizzes</CardTitle>
              <CardDescription>
                Latest quiz activity and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentQuizzes.map((quiz) => (
                  <div key={quiz.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{quiz.title}</h4>
                        {quiz.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {quiz.questions_count} questions • {quiz.attempts_count} attempts
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{quiz.avg_score}% avg</span>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Performers</CardTitle>
              <CardDescription>
                Highest scoring employees this month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topEmployees.map((employee, index) => (
                  <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm font-bold">
                        #{index + 1}
                      </div>
                      <div>
                        <h4 className="font-medium">{employee.full_name}</h4>
                        <p className="text-sm text-muted-foreground">{employee.department}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{employee.total_points} pts</div>
                      <div className="text-sm text-muted-foreground">
                        {employee.tests_completed} tests • {employee.current_streak} streak
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Analytics</CardTitle>
              <CardDescription>
                Key metrics and trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">This Week</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Quiz Attempts</span>
                      <span className="font-medium">{stats.totalAttempts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Average Score</span>
                      <span className="font-medium">{stats.avgScore}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completion Rate</span>
                      <span className="font-medium">{stats.avgCompletionRate}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Trending</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span>Engagement up 12%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span>Scores improving</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span>Avg time: 8 min</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
