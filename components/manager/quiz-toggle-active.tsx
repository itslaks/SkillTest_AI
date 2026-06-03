'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toggleQuizActive } from '@/lib/actions/quiz'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

interface QuizToggleActiveProps {
  quizId: string
  isActive: boolean
}

export function QuizToggleActive({ quizId, isActive }: QuizToggleActiveProps) {
  const [checked, setChecked] = useState(isActive)
  const [isPending, startTransition] = useTransition()

  function handleToggle(newValue: boolean) {
    setChecked(newValue)
    startTransition(async () => {
      const result = await toggleQuizActive(quizId, newValue)
      if (result.error) {
        setChecked(!newValue)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Badge 
        variant={checked ? "default" : "secondary"} 
        className={`text-xs flex items-center gap-1 ${
          checked 
            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
            : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
        }`}
      >
        {checked ? (
          <>
            <CheckCircle2 className="h-3 w-3" />
            Assignable
          </>
        ) : (
          <>
            <AlertTriangle className="h-3 w-3" />
            Review Needed
          </>
        )}
      </Badge>
      <Button
        type="button"
        size="sm"
        variant={checked ? 'outline' : 'default'}
        className={checked ? 'h-8 rounded-full border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50' : 'h-8 rounded-full bg-black text-white hover:bg-zinc-800'}
        disabled={isPending}
        onClick={() => handleToggle(!checked)}
      >
        {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        {checked ? 'Move to draft' : 'Publish'}
      </Button>
    </div>
  )
}
