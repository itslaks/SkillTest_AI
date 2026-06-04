import { getSiteUrl } from '@/lib/security/env'
import { buildEmployeeWelcomeEmail, sendEmail } from '@/lib/email'
import type { Profile } from '@/lib/types/database'

type AdminClient = ReturnType<typeof import('@/lib/supabase/server').createAdminClient>

export interface EmployeeOnboardingInput {
  email: string
  fullName: string
  employeeId?: string | null
  department?: string | null
  domain?: string | null
}

export interface EmployeeOnboardingResult {
  profile: Profile
  warning?: string
}

export async function createEmployeeWithSetupEmail(
  supabase: AdminClient,
  input: EmployeeOnboardingInput,
): Promise<EmployeeOnboardingResult> {
  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()
  const tempPassword = generateTempPassword()

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      role: 'employee',
      full_name: fullName,
    },
  })

  if (authError || !authData.user) {
    throw new Error(authError?.message || 'Could not create user')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      employee_id: input.employeeId || null,
      department: input.department || input.domain || 'General',
      domain: input.domain || 'General',
      role: 'employee',
    })
    .select()
    .single()

  if (profileError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    throw new Error(profileError.message)
  }

  const setupResult = await sendEmployeeSetupEmail(supabase, email, fullName)
  return {
    profile: profile as Profile,
    warning: setupResult.success ? undefined : setupResult.error,
  }
}

export async function sendEmployeeSetupEmail(
  supabase: AdminClient,
  email: string,
  fullName?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const redirectTo = `${getSiteUrl()}/auth/update-password`
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  if (error || !data.properties?.action_link) {
    return { success: false, error: error?.message || 'Could not generate password setup link' }
  }

  const emailResult = await sendEmail({
    to: email,
    subject: 'Set up your SkillTest_AI account',
    html: buildEmployeeWelcomeEmail({
      employeeName: fullName,
      setupLink: data.properties.action_link,
    }),
  })

  return emailResult.success
    ? { success: true }
    : { success: false, error: emailResult.error || 'Could not send setup email' }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `${password}!`
}
