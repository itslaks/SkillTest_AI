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
import { Fingerprint, Layers3 } from 'lucide-react'

interface ProfileCompletionDialogProps {
  profile: Profile
}

export function ProfileCompletionDialog({ profile }: ProfileCompletionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(!profile.employee_id || !profile.domain)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (profile.role !== 'employee') return null

  function handleSubmit(formData: FormData) {
    setError(null)
    formData.set('fullName', profile.full_name || profile.email)
    formData.set('department', profile.department || '')
    formData.set('avatarUrl', profile.avatar_url || '')

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
      <DialogContent className="sm:max-w-md" showCloseButton={Boolean(profile.employee_id && profile.domain)}>
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
