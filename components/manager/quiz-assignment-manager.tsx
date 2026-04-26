'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import { UserPlus, X, Check, Users, Download, ClipboardList } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Employee {
  id: string
  full_name: string | null
  email: string
  employee_id: string | null
  department: string | null
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
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  // Auto-open dialog on mount when redirected from quiz creation
  useEffect(() => {
    if (autoOpen && unassignedEmployees.length > 0) {
      setIsOpen(true)
    }
  }, [autoOpen]) // eslint-disable-line

  const assignedForQuiz = assignments
    .filter((a) => a.quiz_id === selectedQuiz)
    .map((a) => a.user_id)

  const unassignedEmployees = employees.filter((e) => !assignedForQuiz.includes(e.id))

  function handleToggleEmployee(empId: string) {
    setSelectedEmployees((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    )
  }

  function handleSelectAll() {
    if (selectedEmployees.length === unassignedEmployees.length) {
      setSelectedEmployees([])
    } else {
      setSelectedEmployees(unassignedEmployees.map((e) => e.id))
    }
  }

  function handleAssign() {
    if (!selectedQuiz || selectedEmployees.length === 0) return
    startTransition(async () => {
      const result = await assignQuizToEmployees(selectedQuiz, selectedEmployees)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: '✅ Quiz Assigned', description: `Assigned to ${selectedEmployees.length} employee(s).` })
        setSelectedEmployees([])
        setIsOpen(false)
        router.refresh()
      }
    })
  }

  function handleUnassign(quizId: string, employeeId: string) {
    startTransition(async () => {
      const result = await unassignQuizFromEmployee(quizId, employeeId)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: 'Unassigned', description: 'Quiz unassigned from employee.' })
        router.refresh()
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
            {assignments
              .filter((a) => a.quiz_id === selectedQuiz)
              .map((a) => {
                const emp = a.profiles
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {emp?.full_name?.charAt(0) || emp?.email?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp?.full_name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp?.email}</p>
                    </div>
                    {emp?.department && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{emp.department}</Badge>
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
                <div className="flex items-center gap-2 px-2 py-2 mb-1 border-b border-border/50">
                  <Checkbox
                    checked={selectedEmployees.length === unassignedEmployees.length && unassignedEmployees.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm font-medium">Select All ({unassignedEmployees.length})</span>
                </div>
                {unassignedEmployees.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedEmployees.includes(emp.id)}
                      onCheckedChange={() => handleToggleEmployee(emp.id)}
                    />
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {emp.full_name?.charAt(0) || emp.email.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp.full_name || 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                    </div>
                    {emp.department && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{emp.department}</Badge>
                    )}
                  </label>
                ))}
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
