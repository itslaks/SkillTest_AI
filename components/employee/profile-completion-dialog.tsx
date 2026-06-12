'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { updateProfile } from '@/lib/actions/auth'
import { DOMAIN_OPTIONS } from '@/lib/domain-options'
import type { Profile } from '@/lib/types/database'
import { Fingerprint, Layers3, UserRound } from 'lucide-react'
import { AvatarView } from '@/components/avatar/avatar-view'
import { AvatarPickerDialog } from '@/components/avatar/avatar-picker-dialog'
import { DEFAULT_AVATAR_3D_ID, getSafeAvatar3DId, toAvatar3DValue, type Avatar3DId } from '@/lib/avatar-options'

interface ProfileCompletionDialogProps {
  profile: Profile
}

export function ProfileCompletionDialog({ profile }: ProfileCompletionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(!profile.employee_id || !profile.domain)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [avatarId, setAvatarId] = useState<Avatar3DId>(getSafeAvatar3DId(profile.avatar_url || toAvatar3DValue(DEFAULT_AVATAR_3D_ID)))

  if (profile.role !== 'employee') return null

  function handleSubmit(formData: FormData) {
    setError(null)
    formData.set('fullName', profile.full_name || profile.email)
    formData.set('department', profile.department || '')
    formData.set('avatarUrl', toAvatar3DValue(avatarId))

    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result?.error) {
        setError(result.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && (!profile.employee_id || !profile.domain)) return
      setOpen(nextOpen)
    }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" showCloseButton={Boolean(profile.employee_id && profile.domain)}>
        <DialogHeader>
          <DialogTitle>Complete Your Employee Profile</DialogTitle>
          <DialogDescription>
            Employee ID and domain are required before you continue to your learning dashboard.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-4 flex items-center gap-3">
              <AvatarView
                src={toAvatar3DValue(avatarId)}
                alt="Selected profile avatar preview"
                size={64}
                className="h-16 w-16 rounded-2xl border border-white bg-white object-cover shadow-sm"
                interactive
              />
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <UserRound className="h-4 w-4" />
                  Choose your avatar
                </p>
                <p className="text-xs text-muted-foreground">You can keep the default or change it later in profile settings.</p>
              </div>
            </div>
            <AvatarPickerDialog value={avatarId} onChange={setAvatarId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="completion-employee-id" className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4" />
              Employee ID
            </Label>
            <Input
              id="completion-employee-id"
              name="employeeId"
              defaultValue={profile.employee_id || ''}
              placeholder="e.g., EMP1024"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="completion-domain" className="flex items-center gap-2">
              <Layers3 className="h-4 w-4" />
              Domain / Vertical
            </Label>
            <Select name="domain" defaultValue={profile.domain || 'General'} required>
              <SelectTrigger id="completion-domain">
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent>
                {DOMAIN_OPTIONS.map((domain) => (
                  <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? <Spinner className="mr-2" /> : null}
            Save And Continue
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
