'use client'

import { useTransition } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { updateBatchMemberStatus } from '@/lib/actions/training'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function BatchMemberStatusDropdown({
  memberId,
  currentStatus,
  name,
  canEdit = true,
}: {
  memberId: string
  currentStatus: string
  name: string
  canEdit?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const handleStatusChange = (value: string) => {
    if (value === currentStatus) return
    startTransition(async () => {
      const formData = new FormData()
      formData.append('member_id', memberId)
      formData.append('enrollment_status', value)
      const result = await updateBatchMemberStatus(formData)
      if (result.error) {
        toast({
          title: 'Status not updated',
          description: result.error,
          variant: 'destructive',
        })
        return
      }
      toast({
        title: 'Learner status updated',
        description: `${name} is now ${value.replace('_', ' ')}.`,
      })
    })
  }

  const getTone = (status: string) => {
    switch (status) {
      case 'onboarded':
      case 'active':
        return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200'
      case 'not_cleared':
        return 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200'
      case 'discontinued':
      case 'dropped':
        return 'bg-rose-100 text-rose-800 hover:bg-rose-200 border-rose-200'
      case 'offered':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200'
      default:
        return 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border-zinc-200'
    }
  }

  const triggerProps = {
    role: canEdit ? "button" : undefined,
    className: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 ${getTone(currentStatus)} ${!canEdit ? 'cursor-default' : ''}`,
  }

  const badgeContent = (
    <div {...triggerProps}>
      {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
      {name}
    </div>
  )

  if (!canEdit) return badgeContent

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {badgeContent}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuRadioGroup value={currentStatus} onValueChange={handleStatusChange}>
          <DropdownMenuRadioItem value="active">Active (Training)</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="onboarded">Onboarded</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="offered">Offered</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="not_cleared">Not Cleared</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="discontinued">Discontinued</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
