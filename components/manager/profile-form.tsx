'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { updateProfile } from '@/lib/actions/auth'
import type { Profile } from '@/lib/types/database'
import { DEFAULT_AVATAR_VALUE, getSafeAvatar3DId, toAvatar3DValue, type Avatar3DId } from '@/lib/avatar-options'
import { DOMAIN_OPTIONS } from '@/lib/domain-options'
import { Save, User, CheckCircle2, Camera, Image as ImageIcon } from 'lucide-react'
import { AvatarView } from '@/components/avatar/avatar-view'
import { AvatarPickerDialog } from '@/components/avatar/avatar-picker-dialog'

interface ProfileFormProps {
  profile: Profile
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || DEFAULT_AVATAR_VALUE)

  function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 750 * 1024) {
      setError('Profile photo must be below 750 KB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result)
        setError(null)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await updateProfile(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile Information
        </CardTitle>
        <CardDescription>Update your personal details</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="avatarUrl" value={avatarUrl} />
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
          )}
          {success && (
            <div className="p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 rounded-md flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Profile updated successfully
            </div>
          )}

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <AvatarView
                src={avatarUrl}
                alt="Profile avatar preview"
                size={80}
                className="h-20 w-20 rounded-2xl border border-white bg-white object-cover shadow-sm"
                interactive
              />
              <div className="min-w-0 flex-1">
                <Label htmlFor="avatar-upload" className="mb-2 flex items-center gap-2 font-semibold">
                  <Camera className="h-4 w-4" />
                  Profile photo
                </Label>
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleAvatarUpload}
                  className="bg-white"
                />
                <p className="mt-2 text-xs text-muted-foreground">Upload a small photo, or choose one of the premium 3D Memoji presets.</p>
              </div>
            </div>
            <div className="mt-4">
              <AvatarPickerDialog
                value={getSafeAvatar3DId(avatarUrl)}
                onChange={(id: Avatar3DId) => setAvatarUrl(toAvatar3DValue(id))}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                name="fullName"
                defaultValue={profile.full_name || ''}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain / Vertical</Label>
              <Select name="domain" defaultValue={profile.domain || 'General'} required>
                <SelectTrigger id="domain" className="w-full">
                  <SelectValue placeholder="Select domain" />
                </SelectTrigger>
                <SelectContent>
                  {DOMAIN_OPTIONS.map((domain) => (
                    <SelectItem key={domain} value={domain}>{domain}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee ID{profile.role === 'employee' ? ' *' : ''}</Label>
              <Input
                id="employee_id"
                name="employeeId"
                defaultValue={profile.employee_id || ''}
                placeholder="e.g., EMP1024"
                required={profile.role === 'employee'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                name="department"
                defaultValue={profile.department || ''}
                placeholder="e.g., Engineering"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={profile.role}
                disabled
                className="bg-muted capitalize"
              />
            </div>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? <Spinner className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
          <span className="ml-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" />
            Avatar reflects on profile pages after refresh
          </span>
        </form>
      </CardContent>
    </Card>
  )
}
