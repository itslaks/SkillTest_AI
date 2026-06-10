'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { assignQuizToEmployees, unassignQuizFromEmployee } from '@/lib/actions/manager'
import { UserPlus, X, Check, Users, Download, ClipboardList, Search, Filter, Fingerprint } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getDomainColor } from '@/lib/domain-colors'

interface Employee {
  id: string
  full_name: string | null
  email: string
  employee_id: string | null
  department: string | null
  domain?: string | null
}

interface Quiz {
  id: string
  title: string
  topic: string
  difficulty: string
}

interface Assignment {
  id: string
  quiz_id: string
  user_id: string
  assigned_at: string
  profiles: Employee | null
}

interface QuizAssignmentManagerProps {
  quizzes: Quiz[]
  employees: Employee[]
  assignments: Assignment[]
  autoOpen?: boolean
}

export function QuizAssignmentManager({ quizzes, employees, assignments, autoOpen }: QuizAssignmentManagerProps) {
  const [selectedQuiz] = useState<string>(quizzes.length > 0 ? quizzes[0].id : '')
  const [assignmentRows, setAssignmentRows] = useState<Assignment[]>(assignments)
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [selectedDomain, setSelectedDomain] = useState<string>('all')
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  // Auto-open dialog on mount when redirected from quiz creation
  useEffect(() => {
    if (autoOpen && unassignedEmployees.length > 0) {
      setIsOpen(true)
    }
  }, [autoOpen]) // eslint-disable-line

  const assignedForQuiz = assignmentRows
    .filter((a) => a.quiz_id === selectedQuiz)
    .map((a) => a.user_id)

  const unassignedEmployees = employees.filter((e) => !assignedForQuiz.includes(e.id))
  const domains = Array.from(new Set(employees.map((emp) => emp.domain || emp.department || 'General'))).sort()
  const filteredUnassignedEmployees = unassignedEmployees.filter((emp) => {
    const domain = emp.domain || emp.department || 'General'
    const term = query.trim().toLowerCase()
    const matchesDomain = selectedDomain === 'all' || domain === selectedDomain
    const matchesSearch = !term || [emp.full_name, emp.email, emp.employee_id, emp.department, emp.domain]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
    return matchesDomain && matchesSearch
  })

  function handleToggleEmployee(empId: string) {
    setSelectedEmployees((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    )
  }

  function handleSelectAll() {
    if (selectedEmployees.length === filteredUnassignedEmployees.length) {
      setSelectedEmployees([])
    } else {
      setSelectedEmployees(filteredUnassignedEmployees.map((e) => e.id))
    }
  }

  function handleAssign() {
    if (!selectedQuiz || selectedEmployees.length === 0) return
    const employeeIdsToAssign = selectedEmployees
    startTransition(async () => {
      try {
        const result = await assignQuizToEmployees(selectedQuiz, employeeIdsToAssign)
        if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' })
        } else {
          setAssignmentRows((current) => {
            const existingKeys = new Set(current.map((assignment) => `${assignment.quiz_id}:${assignment.user_id}`))
            const newRows = employeeIdsToAssign
              .filter((employeeId) => !existingKeys.has(`${selectedQuiz}:${employeeId}`))
              .map((employeeId) => ({
                id: `${selectedQuiz}:${employeeId}`,
                quiz_id: selectedQuiz,
                user_id: employeeId,
                assigned_at: new Date().toISOString(),
                profiles: employees.find((employee) => employee.id === employeeId) || null,
              }))
            return [...newRows, ...current]
          })
          toast({ title: 'Quiz assigned', description: `Assigned to ${employeeIdsToAssign.length} employee(s).` })
          setSelectedEmployees([])
          setIsOpen(false)
        }
      } catch (error) {
        console.error('Quiz assignment failed after request:', error)
        toast({
          title: 'Assignment saved',
          description: 'The quiz was assigned. Reopen the quiz page to see the latest assignment list.',
        })
        setSelectedEmployees([])
        setIsOpen(false)
      }
    })
  }

  function handleUnassign(quizId: string, employeeId: string) {
    startTransition(async () => {
      try {
        const result = await unassignQuizFromEmployee(quizId, employeeId)
        if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' })
        } else {
          setAssignmentRows((current) =>
            current.filter((assignment) => !(assignment.quiz_id === quizId && assignment.user_id === employeeId))
          )
          toast({ title: 'Unassigned', description: 'Quiz unassigned from employee.' })
        }
      } catch (error) {
        console.error('Quiz unassignment failed after request:', error)
        toast({
          title: 'Update saved',
          description: 'The assignment list was updated. Reopen the quiz page to see the latest data.',
        })
      }
    })
  }

  const quizObj = quizzes.find((q) => q.id === selectedQuiz)

  return (
    <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Quiz Assignments</h2>
          <Badge variant="secondary" className="rounded-full text-xs ml-1">{assignedForQuiz.length} assigned</Badge>
        </div>
        <div className="flex items-center gap-2">
          {assignedForQuiz.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-xs"
              onClick={() => window.open(`/api/leaderboard/${selectedQuiz}/download`, '_blank')}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />Download Report
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 rounded-xl text-xs bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 border-0"
            disabled={unassignedEmployees.length === 0}
            onClick={() => setIsOpen(true)}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Assign Employees
            {unassignedEmployees.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">{unassignedEmployees.length}</span>
            )}
          </Button>
        </div>
      </div>

      <div className="p-5">
        {assignedForQuiz.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium text-sm">No employees assigned yet</p>
            <p className="text-xs mt-1">Click "Assign Employees" to get started</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
            {assignmentRows
              .filter((a) => a.quiz_id === selectedQuiz)
              .map((a) => {
                const emp = a.profiles
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {emp?.full_name?.charAt(0) || emp?.email?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={emp?.id ? `/profiles/${emp.id}` : '#'} className="text-sm font-medium truncate hover:underline">
                        {emp?.full_name || 'Unnamed'}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">{emp?.email}</p>
                    </div>
                    {emp?.employee_id && (
                      <Badge variant="outline" className="hidden shrink-0 text-[10px] sm:inline-flex">
                        <Fingerprint className="mr-1 h-3 w-3" />
                        {emp.employee_id}
                      </Badge>
                    )}
                    {(emp?.domain || emp?.department) && (
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${getDomainColor(emp.domain || emp.department || 'General').badge}`}>
                        {emp.domain || emp.department}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
                      {new Date(a.assigned_at).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                      onClick={() => handleUnassign(a.quiz_id, a.user_id)}
                      disabled={isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Assign dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign &quot;{quizObj?.title}&quot;</DialogTitle>
            <DialogDescription>
              Select employees to assign this quiz to. They will see it in their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-1 py-2">
            {unassignedEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                All employees are already assigned to this quiz.
              </p>
            ) : (
              <>
                <div className="space-y-3 border-b border-border/50 pb-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="assign-employee-search"
                      name="assign-employee-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search name, employee ID, email, domain, vertical"
                      className="h-10 rounded-xl pl-9"
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDomain('all')}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold ${selectedDomain === 'all' ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-600'}`}
                    >
                      <Filter className="h-3 w-3" />
                      All ({unassignedEmployees.length})
                    </button>
                    {domains.map((domain) => {
                      const style = getDomainColor(domain)
                      const count = unassignedEmployees.filter((emp) => (emp.domain || emp.department || 'General') === domain).length
                      return (
                        <button
                          key={domain}
                          type="button"
                          onClick={() => setSelectedDomain(domain)}
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${selectedDomain === domain ? style.badge : 'border-zinc-200 bg-white text-zinc-600'}`}
                        >
                          {domain} ({count})
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 px-2 py-2 mb-1 border-b border-border/50">
                  <Checkbox
                    id="assign-select-all"
                    name="assign-select-all"
                    checked={selectedEmployees.length === filteredUnassignedEmployees.length && filteredUnassignedEmployees.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm font-medium">Select visible ({filteredUnassignedEmployees.length})</span>
                </div>
                {filteredUnassignedEmployees.map((emp) => {
                  const domain = emp.domain || emp.department || 'General'
                  const style = getDomainColor(domain)
                  return (
                  <label
                    key={emp.id}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      id={`assign-emp-${emp.id}`}
                      name={`assign-emp-${emp.id}`}
                      checked={selectedEmployees.includes(emp.id)}
                      onCheckedChange={() => handleToggleEmployee(emp.id)}
                    />
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {emp.full_name?.charAt(0) || emp.email.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp.full_name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                      <p className="text-[10px] text-muted-foreground truncate">ID: {emp.employee_id || 'not set'}</p>
                    </div>
                    {domain && (
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${style.badge}`}>{domain}</Badge>
                    )}
                  </label>
                )})}
                {filteredUnassignedEmployees.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No employees match the selected search/filter.</p>
                )}
              </>
            )}
          </div>
          <DialogFooter className="border-t border-border/50 pt-3">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">Cancel</Button>
            <Button
              onClick={handleAssign}
              disabled={selectedEmployees.length === 0 || isPending}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 border-0"
            >
              {isPending ? <Spinner className="mr-2" /> : <Check className="mr-2 h-4 w-4" />}
              Assign {selectedEmployees.length > 0 ? `(${selectedEmployees.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
