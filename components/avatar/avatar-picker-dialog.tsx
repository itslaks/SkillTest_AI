'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AvatarPicker, Avatar3D } from '@/components/avatar/avatar-3d'
import { getAvatar3DMeta, type Avatar3DId } from '@/lib/avatar-options'
import { CheckCircle2, UserRound } from 'lucide-react'

/**
 * 3D avatar picker dialog: large live preview on the left, selection grid on
 * the right. ESC closes (shadcn Dialog), tiles are keyboard-selectable, and
 * saving still happens in the parent form (Save Changes).
 */
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
          <DialogTitle>Choose your 3D avatar</DialogTitle>
          <DialogDescription>
            Pick an avatar, then save your profile when you are ready.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
          <div className="flex flex-col items-center justify-start gap-3 rounded-3xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-5 text-center">
            <Avatar3D avatarId={value} size={150} priority className="shadow-lg" />
            <div>
              <p className="text-sm font-semibold text-zinc-900">{meta.name}</p>
              <p className="text-xs text-zinc-500">Live preview</p>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" size="sm" className="rounded-lg" onClick={() => setOpen(false)}>
                Use this avatar
              </Button>
              <Button type="button" size="sm" variant="ghost" className="rounded-lg" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
          <AvatarPicker value={value} onChange={onChange} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
