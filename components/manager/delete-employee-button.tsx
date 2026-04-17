'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

interface DeleteEmployeeButtonProps {
  employeeId: string
  employeeName: string
  employeeEmail: string
  hasQuizAttempts?: boolean
}

export function DeleteEmployeeButton({ 
  employeeId, 
  employeeName, 
  employeeEmail, 
  hasQuizAttempts = false 
}: DeleteEmployeeButtonProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  function handleDelete() {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/employees/${employeeId}`, {
          method: 'DELETE',
        })

        const result = await response.json()

        if (response.ok) {
          toast({
            title: 'Employee Removed',
            description: `${employeeName} has been removed from the system.`
          })
          router.refresh()
        } else {
          toast({
            title: 'Error',
            description: result.error || 'Failed to remove employee.',
            variant: 'destructive'
          })
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Network error. Please try again.',
          variant: 'destructive'
        })
      }
      setOpen(false)
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Employee</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove <strong>{employeeName}</strong> ({employeeEmail}) from your organization?
            {hasQuizAttempts && (
              <span className="block mt-2 text-destructive font-medium">
                ⚠️ This employee has quiz attempts that will also be deleted.
              </span>
            )}
            <span className="block mt-2">This action cannot be undone.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isPending ? 'Removing...' : 'Remove Employee'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
