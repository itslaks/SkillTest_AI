'use client'

import { useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent'

type AttendanceRecord = {
  id?: string | null
  session_id: string
  user_id: string
  status: AttendanceStatus
  check_in_time?: string | null
  profile?: {
    full_name?: string | null
    email?: string | null
  } | null
}

type SessionAttendanceCardProps = {
  session: {
    id: string
    title: string
    mode: string
    status: string
    session_date: string
    batch?: { title?: string | null } | null
    trainer?: { full_name?: string | null; email?: string | null } | null
  }
  records: AttendanceRecord[]
  action: (formData: FormData) => Promise<{ error?: string } | unknown>
}

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'late', 'excused', 'absent']

export function ManualAttendanceCard({ session, records, action }: SessionAttendanceCardProps) {
  const initialStatuses = useMemo(
    () => Object.fromEntries(records.map((record) => [record.user_id, record.status])) as Record<string, AttendanceStatus>,
    [records],
  )
  const [statuses, setStatuses] = useState(initialStatuses)
  const [pendingKey, setPendingKey] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const positiveCount = records.filter((record) => ['present', 'late'].includes(statuses[record.user_id] || record.status)).length

  function mark(record: AttendanceRecord, nextStatus: AttendanceStatus) {
    const previous = statuses[record.user_id] || record.status
    const key = `${record.user_id}:${nextStatus}`
    setError('')
    setPendingKey(key)
    setStatuses((current) => ({ ...current, [record.user_id]: nextStatus }))

    startTransition(async () => {
      const formData = new FormData()
      formData.set('session_id', session.id)
      formData.set('user_id', record.user_id)
      formData.set('status', nextStatus)
      const result = await action(formData)
      const maybeError = result && typeof result === 'object' && 'error' in result ? String((result as { error?: string }).error || '') : ''
      if (maybeError) {
        setStatuses((current) => ({ ...current, [record.user_id]: previous }))
        setError(maybeError)
      }
      setPendingKey('')
    })
  }

  return (
    <div className="rounded-[1.5rem] border border-zinc-200 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{session.title}</h3>
            <Badge variant="outline" className="capitalize">{session.mode}</Badge>
            <Badge variant="outline" className="capitalize">{session.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {session.batch?.title || 'Batch'} - {new Date(session.session_date).toLocaleString()} - {session.trainer?.full_name || session.trainer?.email || 'Trainer TBD'}
          </p>
        </div>
        <div className="shrink-0 rounded-full bg-black px-4 py-2 text-sm font-medium text-white">
          {positiveCount}/{records.length} marked
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="mt-4 space-y-3">
        {records.length === 0 ? (
          <p className="text-sm text-zinc-500">Add learners to this batch to begin manual attendance marking.</p>
        ) : (
          records.map((record) => {
            const currentStatus = statuses[record.user_id] || record.status
            return (
              <div key={record.id || `${record.session_id}-${record.user_id}`} className={`rounded-2xl border p-4 ${toneForAttendance(currentStatus)}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-medium">{record.profile?.full_name || record.profile?.email || 'Learner'}</p>
                    <p className="text-sm opacity-80">{currentStatus.toUpperCase()} {record.check_in_time ? `- ${new Date(record.check_in_time).toLocaleTimeString()}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((status) => {
                      const key = `${record.user_id}:${status}`
                      return (
                        <Button
                          key={status}
                          type="button"
                          size="sm"
                          variant={currentStatus === status ? 'default' : 'outline'}
                          disabled={isPending && pendingKey === key}
                          onClick={() => mark(record, status)}
                          className="rounded-full capitalize"
                        >
                          {isPending && pendingKey === key ? 'Saving' : status}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function toneForAttendance(status: string) {
  switch (status) {
    case 'present':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700'
    case 'late':
      return 'bg-amber-50 border-amber-200 text-amber-700'
    case 'excused':
      return 'bg-slate-50 border-slate-200 text-slate-700'
    default:
      return 'bg-rose-50 border-rose-200 text-rose-700'
  }
}
