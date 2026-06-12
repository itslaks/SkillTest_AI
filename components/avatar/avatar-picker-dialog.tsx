'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AvatarPicker, Avatar3D } from '@/components/avatar/avatar-3d'
import { AvatarPlaceholder } from '@/components/avatar/avatar-view'
import { getAvatar3DMeta, type Avatar3DId } from '@/lib/avatar-options'
import { CheckCircle2, UserRound, X } from 'lucide-react'

/**
 * 3D avatar picker dialog. Avatars are OPTIONAL: `value` may be null and the
 * user can clear their selection ("No avatar") or simply proceed without one.
 * Large live preview on the left, keyboard-selectable grid on the right,
 * ESC closes (shadcn Dialog). Saving happens in the parent form.
 */
export function AvatarPickerDialog({
  value,
  onChange,
}: {
  value: Avatar3DId | null
  onChange: (id: Avatar3DId | null) => void
}) {
  const [open, setOpen] = useState(false)
  const meta = value ? getAvatar3DMeta(value) : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center gap-3">
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="rounded-xl">
            <UserRound className="mr-2 h-4 w-4" />
            {meta ? 'Change avatar' : 'Choose avatar (optional)'}
          </Button>
        </DialogTrigger>
        {meta ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {meta.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-500">
            No avatar selected
          </span>
        )}
      </div>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Choose your 3D avatar</DialogTitle>
          <DialogDescription>
            Picking an avatar is optional — you can continue without one and add it later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
          <div className="flex flex-col items-center justify-start gap-3 rounded-3xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-5 text-center">
            {value ? (
              <Avatar3D avatarId={value} size={150} priority className="shadow-lg" />
            ) : (
              <AvatarPlaceholder size={150} className="shadow-inner" />
            )}
            <div>
              <p className="text-sm font-semibold text-zinc-900">{meta?.name || 'No avatar'}</p>
              <p className="text-xs text-zinc-500">Live preview</p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <Button type="button" size="sm" className="rounded-lg" onClick={() => setOpen(false)}>
                {value ? 'Use this avatar' : 'Continue without avatar'}
              </Button>
              {value && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => onChange(null)}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Remove avatar
                </Button>
              )}
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
