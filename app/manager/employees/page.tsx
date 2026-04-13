import { getEmployees, getEmployeesByDomain, getImportHistory } from '@/lib/actions/manager'
import { EmployeeImporter } from '@/components/manager/employee-importer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, Building2, History, Trophy, Flame } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default async function ManagerEmployeesPage() {
  const [{ data: employees }, { data: rawGrouped }, { data: importHistory }] = await Promise.all([
    getEmployees(),
    getEmployeesByDomain(),
    getImportHistory(),
  ])

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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{employees.length}</p>
                <p className="text-xs text-muted-foreground">Total Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{domains.length}</p>
                <p className="text-xs text-muted-foreground">Domains</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Trophy className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {employees.filter((e: any) => e.user_stats?.[0]?.total_quizzes_taken > 0).length}
                </p>
                <p className="text-xs text-muted-foreground">Active Learners</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <History className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{importHistory.length}</p>
                <p className="text-xs text-muted-foreground">Import Operations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import section */}
      <EmployeeImporter />

      {/* Tabs: All employees / By Domain / Import History */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Employees</TabsTrigger>
          <TabsTrigger value="domains">By Domain</TabsTrigger>
          <TabsTrigger value="history">Import History</TabsTrigger>
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
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Employee</th>
                        <th className="text-left p-3 font-medium">Email</th>
                        <th className="text-left p-3 font-medium">Domain</th>
                        <th className="text-left p-3 font-medium">Employee ID</th>
                        <th className="text-left p-3 font-medium">Stats</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp: any) => {
                        const stats = emp.user_stats?.[0]
                        return (
                          <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs">
                                    {emp.full_name?.charAt(0) || emp.email?.charAt(0) || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{emp.full_name || 'Unnamed'}</span>
                              </div>
                            </td>
                            <td className="p-3 text-muted-foreground">{emp.email}</td>
                            <td className="p-3">
                              {emp.domain ? (
                                <Badge variant="outline" className="text-xs">{emp.domain}</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground font-mono text-xs">{emp.employee_id || '—'}</td>
                            <td className="p-3">
                              {stats ? (
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="flex items-center gap-1">
                                    <Trophy className="h-3 w-3 text-yellow-500" />
                                    {stats.total_points || 0} pts
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Flame className="h-3 w-3 text-orange-500" />
                                    {stats.current_streak || 0}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">No activity</span>
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
