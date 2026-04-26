import { getUserProfile } from '@/lib/actions/auth'
import { redirect } from 'next/navigation'
import { ProfileForm } from '@/components/manager/profile-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Key, Globe } from 'lucide-react'

export default async function ManagerSettingsPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/auth/login')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and platform preferences</p>
      </div>

      {/* Profile form */}
      <ProfileForm profile={profile} />

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>Read-only account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Account ID</p>
              <p className="text-sm font-mono truncate">{profile.id}</p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Role</p>
              <Badge variant="default" className="capitalize">{profile.role}</Badge>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Member Since</p>
              <p className="text-sm">{new Date(profile.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          {profile.employee_id && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Employee ID</p>
              <p className="text-sm font-mono">{profile.employee_id}</p>
            </div>
          )}
          {profile.domain && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Domain</p>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm">{profile.domain}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Password changes and account deletion are managed through your Supabase authentication provider.
            Contact your administrator for password resets or account access issues.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
