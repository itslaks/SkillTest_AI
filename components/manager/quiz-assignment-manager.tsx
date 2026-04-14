'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { assignQuizToEmployees, unassignQuizFromEmployee } from '@/lib/actions/manager'
import { ClipboardList, UserPlus, X, Check } from 'lucide-react'
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
}

export function QuizAssignmentManager({ quizzes, employees, assignments }: QuizAssignmentManagerProps) {
  const [selectedQuiz, setSelectedQuiz] = useState<string>(quizzes.length > 0 ? quizzes[0].id : '')
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  // Get assigned employee IDs for the selected quiz
  const assignedForQuiz = assignments
    .filter((a) => a.quiz_id === selectedQuiz)
    .map((a) => a.user_id)

  // Employees not yet assigned to the selected quiz
  const unassignedEmployees = employees.filter(
    (e) => !assignedForQuiz.includes(e.id)
  )

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
        toast({
          title: 'Quizzes Assigned',
          description: `Successfully assigned quiz to ${selectedEmployees.length} employee(s).`,
        })
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          Quiz Assignments
        </CardTitle>
        <CardDescription>
          Assign quizzes to employees. Employees can only see and take quizzes assigned to them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quiz selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select a Quiz</label>
          <div className="flex flex-wrap gap-2">
            {quizzes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active quizzes. Create one first.</p>
            ) : (
              quizzes.map((quiz) => {
                const assignCount = assignments.filter((a) => a.quiz_id === quiz.id).length
                return (
                  <button
                    key={quiz.id}
                    onClick={() => {
                      setSelectedQuiz(quiz.id)
                      setSelectedEmployees([])
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      selectedQuiz === quiz.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {quiz.title}
                    <Badge variant="secondary" className="text-xs">{assignCount}</Badge>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Assigned employees for selected quiz */}
        {selectedQuiz && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                Assigned to &quot;{quizObj?.title}&quot; ({assignedForQuiz.length})
              </h4>
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={unassignedEmployees.length === 0}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign Employees
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Assign &quot;{quizObj?.title}&quot;</DialogTitle>
                    <DialogDescription>
                      Select employees to assign this quiz to. They will see it in their dashboard.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex-1 overflow-y-auto space-y-1 py-2">
                    {unassignedEmployees.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        All employees are already assigned to this quiz.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 px-2 py-1 mb-2 border-b pb-2">
                          <Checkbox
                            checked={selectedEmployees.length === unassignedEmployees.length && unassignedEmployees.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                          <span className="text-sm font-medium">
                            Select All ({unassignedEmployees.length})
                          </span>
                        </div>
                        {unassignedEmployees.map((emp) => (
                          <label
                            key={emp.id}
                            className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedEmployees.includes(emp.id)}
                              onCheckedChange={() => handleToggleEmployee(emp.id)}
                            />
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-xs">
                                {emp.full_name?.charAt(0) || emp.email.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{emp.full_name || 'Unnamed'}</p>
                              <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                            </div>
                            {emp.department && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {emp.department}
                              </Badge>
                            )}
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button
                      onClick={handleAssign}
                      disabled={selectedEmployees.length === 0 || isPending}
                    >
                      {isPending ? <Spinner className="mr-2" /> : <Check className="mr-2 h-4 w-4" />}
                      Assign {selectedEmployees.length > 0 ? `(${selectedEmployees.length})` : ''}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* List of assigned employees */}
            {assignedForQuiz.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground border rounded-lg">
                <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No employees assigned yet. Click &quot;Assign Employees&quot; to get started.</p>
              </div>
            ) : (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {assignments
                  .filter((a) => a.quiz_id === selectedQuiz)
                  .map((a) => {
                    const emp = a.profiles
                    return (
                      <div key={a.id} className="flex items-center gap-3 px-3 py-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {emp?.full_name?.charAt(0) || emp?.email?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{emp?.full_name || 'Unnamed'}</p>
                          <p className="text-xs text-muted-foreground truncate">{emp?.email}</p>
                        </div>
                        {emp?.department && (
                          <Badge variant="outline" className="text-[10px]">{emp.department}</Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(a.assigned_at).toLocaleDateString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
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
        )}
      </CardContent>
    </Card>
  )
}
