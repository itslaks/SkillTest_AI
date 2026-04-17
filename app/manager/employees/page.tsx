import { getEmployees, getEmployeesByDomain, getImportHistory, getQuizzesForAssignment } from '@/lib/actions/manager'
import { createClient } from '@/lib/supabase/server'
import { EmployeeImporter } from '@/components/manager/employee-importer'
import { QuizAssignmentManager } from '@/components/manager/quiz-assignment-manager'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, Building2, History, Trophy, Flame } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default async function ManagerEmployeesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: employees }, { data: rawGrouped }, { data: importHistory }, { data: quizzes }] = await Promise.all([
    getEmployees(),
    getEmployeesByDomain(),
    getImportHistory(),
    getQuizzesForAssignment(),
  ])

  // Fetch all assignments for the manager's quizzes
  const quizIds = (quizzes || []).map((q: any) => q.id)
  let allAssignments: any[] = []
  if (quizIds.length > 0) {
    const { data: assignments } = await supabase
      .from('quiz_assignments')
      .select('*, profiles:user_id(id, full_name, email, employee_id, department, avatar_url)')
      .in('quiz_id', quizIds)
      .order('assigned_at', { ascending: false })
    allAssignments = assignments || []
  }

  const grouped = rawGrouped as Record<string, any[]>
  const domains = Object.keys(grouped)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Employees</h1>
        <p className="text-muted-foreground mt-1">Manage your team and import new employees</p>
      </div>

      {/* Stats overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500 rounded-xl">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">{employees.length}</p>
                <p className="text-xs text-blue-600/70 font-medium">Total Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-100">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500 rounded-xl">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{domains.length}</p>
                <p className="text-xs text-purple-600/70 font-medium">Domains</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-500 rounded-xl">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">
                  {employees.filter((e: any) => e.user_stats?.[0]?.tests_completed > 0).length}
                </p>
                <p className="text-xs text-green-600/70 font-medium">Active Learners</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-100">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-500 rounded-xl">
                <History className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700">{importHistory.length}</p>
                <p className="text-xs text-orange-600/70 font-medium">Import Operations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import section */}
      <EmployeeImporter />

      {/* Quiz Assignment section */}
      <QuizAssignmentManager
        quizzes={(quizzes || []).map((q: any) => ({
          id: q.id,
          title: q.title,
          topic: q.topic,
          difficulty: q.difficulty,
        }))}
        employees={employees.map((e: any) => ({
          id: e.id,
          full_name: e.full_name,
          email: e.email,
          employee_id: e.employee_id,
          department: e.department,
        }))}
        assignments={allAssignments}
      />

      {/* Tabs: All employees / By Domain / Import History */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">All Employees ({employees.length})</TabsTrigger>
          <TabsTrigger value="domains" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">By Domain ({domains.length})</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Import History</TabsTrigger>
        </TabsList>

        {/* All employees */}
        <TabsContent value="all" className="space-y-4">
          {employees.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No employees yet. Import an Excel file to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Employee</th>
                        <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Email</th>
                        <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Domain</th>
                        <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Employee ID</th>
                        <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">Performance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp: any) => {
                        const stats = emp.user_stats?.[0]
                        return (
                          <tr key={emp.id} className="border-b hover:bg-blue-50/30 transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                                  {emp.full_name?.charAt(0) || emp.email?.charAt(0) || '?'}
                                </div>
                                <span className="font-semibold">{emp.full_name || 'Unnamed'}</span>
                              </div>
                            </td>
                            <td className="p-3 text-muted-foreground text-sm">{emp.email}</td>
                            <td className="p-3">
                              {emp.domain ? (
                                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">{emp.domain}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground font-mono text-xs">{emp.employee_id || '—'}</td>
                            <td className="p-3">
                              {stats ? (
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
                                    <Trophy className="h-3 w-3" />
                                    {stats.total_points || 0} pts
                                  </span>
                                  {stats.current_streak > 0 && (
                                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 text-orange-700 font-medium">
                                      <Flame className="h-3 w-3" />
                                      {stats.current_streak}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">No activity yet</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* By Domain */}
        <TabsContent value="domains" className="space-y-4">
          {domains.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No domains found.</p>
              </CardContent>
            </Card>
          ) : (
            domains.map((domain) => (
              <Card key={domain}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5" />
                    {domain}
                    <Badge variant="secondary" className="ml-2">{grouped[domain].length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {grouped[domain].map((emp: any) => (
                      <div key={emp.id} className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {emp.full_name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{emp.full_name || emp.email}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Import History */}
        <TabsContent value="history" className="space-y-4">
          {importHistory.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No import history yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Total</th>
                        <th className="text-left p-3 font-medium">Success</th>
                        <th className="text-left p-3 font-medium">Failed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importHistory.map((imp: any) => (
                        <tr key={imp.id} className="border-b">
                          <td className="p-3">{new Date(imp.created_at).toLocaleDateString()}</td>
                          <td className="p-3">
                            <Badge variant={imp.status === 'completed' ? 'default' : 'destructive'} className="text-xs">
                              {imp.status}
                            </Badge>
                          </td>
                          <td className="p-3">{imp.total_records}</td>
                          <td className="p-3 text-green-600">{imp.successful_imports}</td>
                          <td className="p-3 text-red-600">{imp.failed_imports}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
