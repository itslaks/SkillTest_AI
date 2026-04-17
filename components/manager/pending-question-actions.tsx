'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle } from 'lucide-react'
import { approveQuestion, rejectQuestion } from '@/lib/actions/quiz'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

interface PendingQuestionActionsProps {
  questionId: string
}

export function PendingQuestionActions({ questionId }: PendingQuestionActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending')

  async function handleApprove() {
    startTransition(async () => {
      const result = await approveQuestion(questionId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setStatus('approved')
        toast.success('Question approved')
      }
    })
  }

  async function handleReject() {
    startTransition(async () => {
      const result = await rejectQuestion(questionId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setStatus('rejected')
        toast.success('Question rejected')
      }
    })
  }

  if (status === 'approved') {
    return (
      <div className="flex items-center text-green-600 text-xs font-medium gap-1">
        <CheckCircle2 className="h-4 w-4" /> Approved
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="flex items-center text-red-600 text-xs font-medium gap-1">
        <XCircle className="h-4 w-4" /> Rejected
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <Button 
        size="sm" 
        variant="ghost" 
        className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50"
        onClick={handleApprove}
        disabled={isPending}
      >
        {isPending ? <Spinner className="h-3 w-3" /> : <CheckCircle2 className="h-4 w-4" />}
      </Button>
      <Button 
        size="sm" 
        variant="ghost" 
        className="h-7 text-destructive hover:text-red-700 hover:bg-red-50"
        onClick={handleReject}
        disabled={isPending}
      >
        {isPending ? <Spinner className="h-3 w-3" /> : <XCircle className="h-4 w-4" />}
      </Button>
    </div>
  )
}
