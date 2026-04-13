'use client'

import { useState, useTransition } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toggleQuizActive } from '@/lib/actions/quiz'

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
        setChecked(!newValue) // Revert on error
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        id={`active-${quizId}`}
        checked={checked}
        onCheckedChange={handleToggle}
        disabled={isPending}
      />
      <Label htmlFor={`active-${quizId}`} className="text-sm">
        {checked ? 'Active' : 'Draft'}
      </Label>
    </div>
  )
}
