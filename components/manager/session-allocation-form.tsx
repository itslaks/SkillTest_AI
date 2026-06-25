'use client'

import { useMemo, useState } from 'react'
import { OpsSubmitButton } from '@/components/manager/ops-submit-button'

type BatchOption = { id: string; title: string }
type TrainerOption = { id: string; full_name?: string | null; email?: string | null }
type EmployeeOption = {
  id: string
  full_name?: string | null
  email?: string | null
  employee_id?: string | null
  department?: string | null
  domain?: string | null
}
type TrainerEmployeeAssignment = {
  trainer_id: string
  employee_id: string
}

export function SessionAllocationForm({
  action,
  batches,
  trainers,
  employees,
  trainerEmployeeAssignments,
}: {
  action: (formData: FormData) => void | Promise<void>
  batches: BatchOption[]
  trainers: TrainerOption[]
  employees: EmployeeOption[]
  trainerEmployeeAssignments: TrainerEmployeeAssignment[]
}) {
  const [trainerId, setTrainerId] = useState('')

  const employeesByTrainer = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const assignment of trainerEmployeeAssignments) {
      if (!assignment.trainer_id || !assignment.employee_id) continue
      const set = map.get(assignment.trainer_id) || new Set<string>()
      set.add(assignment.employee_id)
      map.set(assignment.trainer_id, set)
    }
    return map
  }, [trainerEmployeeAssignments])

  const visibleEmployees = useMemo(() => {
    if (!trainerId) return employees
    const scopedEmployeeIds = employeesByTrainer.get(trainerId) || new Set<string>()
    return employees.filter((employee) => scopedEmployeeIds.has(employee.id))
  }, [employees, employeesByTrainer, trainerId])

  const selectedTrainer = trainers.find((trainer) => trainer.id === trainerId)
  const selectedTrainerName = selectedTrainer?.full_name || selectedTrainer?.email || 'selected trainer'

  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Target batch</span>
        <select name="batch_id" required className="h-11 rounded-xl border border-zinc-200 px-3">
          <option value="">Select batch</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.title}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Session title</span>
          <input name="title" required className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="Week 1 Foundation Lab" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Trainer</span>
          <select
            name="trainer_id"
            value={trainerId}
            onChange={(event) => setTrainerId(event.target.value)}
            className="h-11 rounded-xl border border-zinc-200 px-3"
          >
            <option value="">Auto/Unassigned</option>
            {trainers.map((trainer) => (
              <option key={trainer.id} value={trainer.id}>
                {trainer.full_name || trainer.email}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Agenda</span>
        <textarea name="agenda" rows={3} className="rounded-xl border border-zinc-200 px-3 py-3" placeholder="Concept coverage, practicals, feedback checkpoints, blockers." />
      </label>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Meeting / classroom link</span>
        <input name="meeting_url" type="url" className="h-11 rounded-xl border border-zinc-200 px-3" placeholder="https://meet.google.com/abc-defg-hij or office room link" />
      </label>

      <label className="grid gap-2 text-sm">
        <span className="font-medium">Session learners</span>
        <select
          name="employee_ids"
          multiple
          size={Math.min(6, Math.max(3, visibleEmployees.length || 3))}
          className="min-h-28 rounded-xl border border-zinc-200 px-3 py-2"
        >
          {visibleEmployees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name || employee.email} {employee.employee_id ? `(${employee.employee_id})` : ''}
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-500">
          {trainerId
            ? visibleEmployees.length
              ? `Showing only employees assigned under ${selectedTrainerName}. If none are selected, all visible employees will receive the session mail.`
              : `No employees are assigned under ${selectedTrainerName}. Assign employees to this trainer in Admin first.`
            : 'Select a trainer to narrow learners to only that trainer roster.'}
        </span>
      </label>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Session date & time</span>
          <input name="session_date" type="datetime-local" required className="h-11 w-full min-w-0 rounded-xl border border-zinc-200 px-3" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Mode</span>
          <select name="mode" defaultValue="virtual" className="h-11 rounded-xl border border-zinc-200 px-3">
            <option value="virtual">Virtual</option>
            <option value="classroom">Classroom</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Status</span>
          <select name="status" defaultValue="scheduled" className="h-11 rounded-xl border border-zinc-200 px-3">
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium">
        <input type="checkbox" name="attendance_required" defaultChecked className="h-4 w-4 rounded border-zinc-300" />
        Attendance required for this session
      </label>
      <OpsSubmitButton pendingLabel="Scheduling..." className="rounded-full bg-black text-white hover:bg-zinc-800">Schedule session</OpsSubmitButton>
    </form>
  )
}
