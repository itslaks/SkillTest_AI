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
  const employeeId = input.employeeId?.trim()
  const domain = input.domain?.trim()
  const tempPassword = generateTempPassword()

  if (!employeeId || !domain) {
    throw new Error('Employee ID and domain are required')
  }

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle()

  if (existingProfile) {
    return updateExistingEmployeeProfile(supabase, existingProfile as Profile, {
      email,
      fullName,
      employeeId,
      department: input.department || domain,
      domain,
    })
  }

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
    if (isDuplicateAuthUserError(authError?.message)) {
      const { data: profileAfterAuthConflict } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      if (profileAfterAuthConflict) {
        return updateExistingEmployeeProfile(supabase, profileAfterAuthConflict as Profile, {
          email,
          fullName,
          employeeId,
          department: input.department || domain,
          domain,
        })
      }

      throw new Error(`Auth account already exists for ${email}, but no employee profile was found. Ask an admin to link or remove that auth user, then retry.`)
    }
    throw new Error(authError?.message || 'Could not create user')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      employee_id: employeeId,
      department: input.department || domain,
      domain,
      role: 'employee',
    })
    .select()
    .single()

  if (profileError) {
    if (profileError.code === '23505') {
      const { data: profileById } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (profileById) {
        return updateExistingEmployeeProfile(supabase, profileById as Profile, {
          email,
          fullName,
          employeeId,
          department: input.department || domain,
          domain,
        })
      }
    }

    await supabase.auth.admin.deleteUser(authData.user.id)
    throw new Error(profileError.message)
  }

  const setupResult = await sendEmployeeSetupEmail(supabase, email, fullName)
  return {
    profile: profile as Profile,
    warning: setupResult.success ? undefined : setupResult.error,
  }
}

async function updateExistingEmployeeProfile(
  supabase: AdminClient,
  profile: Profile,
  input: {
    email: string
    fullName: string
    employeeId: string
    department: string | null
    domain: string
  },
): Promise<EmployeeOnboardingResult> {
  if (profile.role !== 'employee') {
    throw new Error(`A ${profile.role} profile already exists for ${input.email}. Use the user management screen to edit this account instead of adding it as an employee.`)
  }

  const { data: updatedProfile, error } = await supabase
    .from('profiles')
    .update({
      email: input.email,
      full_name: input.fullName,
      employee_id: input.employeeId,
      department: input.department,
      domain: input.domain,
      role: 'employee',
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .select()
    .single()

  if (error || !updatedProfile) {
    throw new Error(error?.message || 'Could not update existing employee profile')
  }

  const setupResult = await sendEmployeeSetupEmail(supabase, input.email, input.fullName)
  return {
    profile: updatedProfile as Profile,
    warning: setupResult.success ? undefined : `Employee profile was updated, but setup email failed: ${setupResult.error}`,
  }
}

function isDuplicateAuthUserError(message?: string | null) {
  if (!message) return false
  const normalized = message.toLowerCase()
  return normalized.includes('already registered')
    || normalized.includes('already exists')
    || normalized.includes('duplicate')
}

export async function sendEmployeeSetupEmail(
  supabase: AdminClient,
  email: string,
  fullName?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const siteUrl = getSiteUrl().replace(/\/$/, '')
  const redirectTo = `${siteUrl}/auth/update-password`
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  if (error || !data.properties?.action_link) {
    return { success: false, error: error?.message || 'Could not generate password setup link' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('employee_id')
    .eq('email', email)
    .maybeSingle()
  const signUpParams = new URLSearchParams({ role: 'employee', email })
  if (profile?.employee_id) signUpParams.set('employeeId', profile.employee_id)

  const emailResult = await sendEmail({
    to: email,
    subject: 'Set up your SkillTest_AI account',
    html: buildEmployeeWelcomeEmail({
      employeeName: fullName,
      setupLink: data.properties.action_link,
      signUpLink: `${siteUrl}/auth/sign-up?${signUpParams.toString()}`,
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
