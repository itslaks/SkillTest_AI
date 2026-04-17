'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  UserPlus, 
  FileQuestion, 
  Plus, 
  Settings, 
  Download, 
  BarChart3,
  Trash2,
  Clock,
  Trophy,
  Activity
} from 'lucide-react'
import Link from 'next/link'
import { AddEmployeeDialog } from './add-employee-dialog'
import { DeleteEmployeeButton } from './delete-employee-button'

interface QuickManagementPanelProps {
  stats: {
    totalQuizzes: number
    totalEmployees: number
    activeQuizzes: number
    totalAttempts: number
    averageScore: number
  }
  recentEmployees: Array<{
    id: string
    full_name: string
    email: string
    department: string
    created_at: string
    quiz_attempts_count?: number
  }>
  recentQuizzes: Array<{
    id: string
    title: string
    is_active: boolean
    questions_count: number
    attempts_count: number
    created_at: string
  }>
}

export function QuickManagementPanel({ stats, recentEmployees, recentQuizzes }: QuickManagementPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'employees' | 'quizzes'>('overview')

  return (
    <div className="space-y-6">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <FileQuestion className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalQuizzes}</p>
                <p className="text-xs text-muted-foreground">Total Quizzes</p>
                <p className="text-xs text-green-600">{stats.activeQuizzes} active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalEmployees}</p>
                <p className="text-xs text-muted-foreground">Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalAttempts}</p>
                <p className="text-xs text-muted-foreground">Total Attempts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <BarChart3 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.averageScore}%</p>
                <p className="text-xs text-muted-foreground">Avg Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-2">
              <AddEmployeeDialog />
              <Button size="sm" variant="outline" asChild>
                <Link href="/manager/quizzes/new">
                  <Plus className="h-4 w-4 mr-1" />
                  New Quiz
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Management Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'employees', label: 'Quick Employee Mgmt', icon: Users },
          { id: 'quizzes', label: 'Quick Quiz Mgmt', icon: FileQuestion },
        ].map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id as any)}
            className="flex-1"
          >
            <tab.icon className="h-4 w-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/manager/employees">
                  <Users className="h-4 w-4 mr-3" />
                  Manage All Employees
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/manager/quizzes">
                  <FileQuestion className="h-4 w-4 mr-3" />
                  Manage All Quizzes
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/manager/reports">
                  <Download className="h-4 w-4 mr-3" />
                  Download Reports
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/manager/analytics">
                  <BarChart3 className="h-4 w-4 mr-3" />
                  View Analytics
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Active Quizzes</span>
                  <Badge variant={stats.activeQuizzes > 0 ? "default" : "secondary"}>
                    {stats.activeQuizzes} / {stats.totalQuizzes}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Employee Engagement</span>
                  <Badge variant={stats.totalAttempts > 0 ? "default" : "secondary"}>
                    {stats.totalAttempts > 0 ? 'Active' : 'No Activity'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average Performance</span>
                  <Badge variant={stats.averageScore >= 70 ? "default" : stats.averageScore >= 50 ? "secondary" : "destructive"}>
                    {stats.averageScore >= 70 ? 'Good' : stats.averageScore >= 50 ? 'Fair' : 'Needs Attention'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'employees' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Employees</CardTitle>
              <CardDescription>Quick employee management actions</CardDescription>
            </div>
            <AddEmployeeDialog />
          </CardHeader>
          <CardContent>
            {recentEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No employees yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentEmployees.slice(0, 5).map((employee) => (
                  <div key={employee.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                        {employee.full_name?.charAt(0) || 'E'}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{employee.full_name}</p>
                        <p className="text-xs text-muted-foreground">{employee.email}</p>
                        {employee.department && (
                          <Badge variant="outline" className="text-[10px] mt-1">{employee.department}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {employee.quiz_attempts_count || 0} attempts
                      </span>
                      <DeleteEmployeeButton
                        employeeId={employee.id}
                        employeeName={employee.full_name}
                        employeeEmail={employee.email}
                        hasQuizAttempts={(employee.quiz_attempts_count || 0) > 0}
                      />
                    </div>
                  </div>
                ))}
                {recentEmployees.length > 5 && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/manager/employees">
                      View All {recentEmployees.length} Employees
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'quizzes' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recent Quizzes</CardTitle>
              <CardDescription>Quick quiz management actions</CardDescription>
            </div>
            <Button size="sm" asChild>
              <Link href="/manager/quizzes/new">
                <Plus className="h-4 w-4 mr-2" />
                New Quiz
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentQuizzes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No quizzes yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentQuizzes.slice(0, 5).map((quiz) => (
                  <div key={quiz.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{quiz.title}</p>
                        <Badge variant={quiz.is_active ? "default" : "secondary"} className="text-[10px]">
                          {quiz.is_active ? 'Active' : 'Draft'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{quiz.questions_count} questions</span>
                        <span>•</span>
                        <span>{quiz.attempts_count} attempts</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/manager/quizzes/${quiz.id}`}>
                          <Settings className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
                {recentQuizzes.length > 5 && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/manager/quizzes">
                      View All {recentQuizzes.length} Quizzes
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
