'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AvatarPicker } from '@/components/avatar/avatar-3d'
import { AvatarView } from '@/components/avatar/avatar-view'
import { getAvatar3DMeta, toAvatar3DValue, type Avatar3DId } from '@/lib/avatar-options'
import { CheckCircle2, UserRound } from 'lucide-react'

export function AvatarPickerDialog({
  value,
  onChange,
}: {
  value: Avatar3DId
  onChange: (id: Avatar3DId) => void
}) {
  const [open, setOpen] = useState(false)
  const meta = getAvatar3DMeta(value)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-3">
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="rounded-xl">
            <UserRound className="mr-2 h-4 w-4" />
            Choose avatar
          </Button>
        </DialogTrigger>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {meta.name}
        </span>
      </div>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Choose your 3D Memoji avatar</DialogTitle>
          <DialogDescription>
            Preview a preset and save your profile when you are ready.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-center">
            <AvatarView
              src={toAvatar3DValue(value)}
              alt={`${meta.name} avatar preview`}
              size={144}
              className="mx-auto h-36 w-36 rounded-[2rem] border border-white bg-white object-cover shadow-lg"
              priority
            />
            <p className="mt-3 text-sm font-semibold text-zinc-900">{meta.name}</p>
            <p className="text-xs text-zinc-500">Instant preview</p>
          </div>
          <AvatarPicker value={value} onChange={onChange} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
