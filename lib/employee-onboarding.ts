import { getPasswordResetRedirectUrl, getSiteUrl } from '@/lib/security/env'
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

type AuthUser = {
  id: string
  email?: string
  email_confirmed_at?: string | null
  user_metadata?: Record<string, unknown>
}

type AuthCleanupResult = {
  foundAuthUsers: number
  deletedAuthUsers: number
  keptAuthUsers: AuthUser[]
  warnings: string[]
}

function authRole(user: AuthUser) {
  return String(user.user_metadata?.role || 'employee')
}

function logAuthCleanup(message: string, metadata: Record<string, unknown>) {
  console.info('[employee-auth-cleanup]', { message, ...metadata })
}

export async function findAuthUsersByEmail(supabase: AdminClient, email: string): Promise<AuthUser[]> {
  const target = email.trim().toLowerCase()
  const matches: AuthUser[] = []
  const perPage = 1000

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Could not inspect Supabase Auth users: ${error.message}`)

    for (const user of data.users || []) {
      if (user.email?.trim().toLowerCase() === target) {
        matches.push(user as AuthUser)
      }
    }

    if (!data.users || data.users.length < perPage) break
  }

  return matches
}

export async function deleteEmployeeAccount(
  supabase: AdminClient,
  input: { id: string; email: string },
): Promise<{ deletedAuthUsers: number; deletedProfile: boolean; warnings: string[] }> {
  const warnings: string[] = []
  let deletedAuthUsers = 0

  const authIds = new Set<string>([input.id])
  try {
    const matchingAuthUsers = await findAuthUsersByEmail(supabase, input.email)
    logAuthCleanup('delete flow searched auth by email', {
      email: input.email,
      profileId: input.id,
      matchingAuthUserIds: matchingAuthUsers.map((user) => user.id),
    })
    for (const user of matchingAuthUsers) authIds.add(user.id)
  } catch (error: any) {
    warnings.push(error?.message || 'Could not inspect matching Supabase Auth users before deletion.')
  }

  for (const authId of authIds) {
    const { error } = await supabase.auth.admin.deleteUser(authId)
    if (!error) {
      deletedAuthUsers++
      logAuthCleanup('deleted auth user during employee deletion', {
        email: input.email,
        profileId: input.id,
        authUserId: authId,
      })
      continue
    }

    if (/not found|does not exist|404/i.test(error.message || '')) {
      continue
    }

    warnings.push(`Auth user ${authId} was not deleted: ${error.message}`)
  }

  const { data: remainingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', input.id)
    .maybeSingle()

  let deletedProfile = !remainingProfile
  if (remainingProfile) {
    const { error } = await supabase.from('profiles').delete().eq('id', input.id)
    if (error) {
      warnings.push(`Profile row was not deleted: ${error.message}`)
    } else {
      deletedProfile = true
    }
  }

  if (!deletedProfile || warnings.some((warning) => warning.includes('Auth user'))) {
    throw new Error(warnings.join(' ') || 'Employee account could not be fully deleted.')
  }

  const remaining = await findAuthUsersByEmail(supabase, input.email).catch((error: any) => {
    warnings.push(`Could not confirm auth cleanup by email: ${error?.message || 'unknown error'}`)
    return []
  })
  if (remaining.length > 0) {
    throw new Error(`Employee profile was removed, but ${remaining.length} Supabase Auth user(s) still exist for ${input.email}.`)
  }

  return { deletedAuthUsers, deletedProfile, warnings }
}

export async function cleanupOrphanEmployeeAuthUsersByEmail(
  supabase: AdminClient,
  email: string,
  options: { preserveProfileId?: string | null; reason?: string } = {},
): Promise<AuthCleanupResult> {
  const warnings: string[] = []
  const keptAuthUsers: AuthUser[] = []
  let deletedAuthUsers = 0
  const authUsers = await findAuthUsersByEmail(supabase, email)

  logAuthCleanup('searched auth users by email', {
    email,
    preserveProfileId: options.preserveProfileId || null,
    reason: options.reason || 'not_provided',
    foundAuthUserIds: authUsers.map((user) => user.id),
  })

  for (const authUser of authUsers) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileError) {
      warnings.push(`Could not inspect profile for auth user ${authUser.id}: ${profileError.message}`)
      keptAuthUsers.push(authUser)
      continue
    }

    if (profile) {
      keptAuthUsers.push(authUser)
      logAuthCleanup('kept auth user with active profile', {
        email,
        authUserId: authUser.id,
        profileId: profile.id,
        profileRole: profile.role,
      })
      continue
    }

    const role = authRole(authUser)
    if (role !== 'employee') {
      warnings.push(`Auth user ${authUser.id} has role ${role}; cleanup skipped.`)
      keptAuthUsers.push(authUser)
      continue
    }

    const { error } = await supabase.auth.admin.deleteUser(authUser.id)
    if (error) {
      warnings.push(`Auth user ${authUser.id} was not deleted: ${error.message}`)
      keptAuthUsers.push(authUser)
      console.warn('[employee-auth-cleanup] delete failed', {
        email,
        authUserId: authUser.id,
        code: (error as any).code || null,
        message: error.message,
      })
      continue
    }

    deletedAuthUsers++
    logAuthCleanup('deleted orphan employee auth user', {
      email,
      authUserId: authUser.id,
      reason: options.reason || 'not_provided',
    })
  }

  return {
    foundAuthUsers: authUsers.length,
    deletedAuthUsers,
    keptAuthUsers,
    warnings,
  }
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
    email_confirm: false,
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

      const authUsers = await findAuthUsersByEmail(supabase, email)
      const employeeAuthUser = authUsers.find((user) => {
        const role = String(user.user_metadata?.role || 'employee')
        return role === 'employee'
      })

      if (employeeAuthUser) {
        return restoreEmployeeProfileForAuthUser(supabase, employeeAuthUser.id, {
          email,
          fullName,
          employeeId,
          department: input.department || domain,
          domain,
          tempPassword,
        })
      }

      throw new Error(`Auth account already exists for ${email}, but it is not an employee account. Use admin user management or delete the conflicting auth user before adding this employee.`)
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

async function restoreEmployeeProfileForAuthUser(
  supabase: AdminClient,
  authUserId: string,
  input: {
    email: string
    fullName: string
    employeeId: string
    department: string | null
    domain: string
    tempPassword: string
  },
): Promise<EmployeeOnboardingResult> {
  await supabase.auth.admin.updateUserById(authUserId, {
    password: input.tempPassword,
    user_metadata: {
      role: 'employee',
      full_name: input.fullName,
      employee_id: input.employeeId,
      domain: input.domain,
      department: input.department,
    },
  })

  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert({
      id: authUserId,
      email: input.email,
      full_name: input.fullName,
      employee_id: input.employeeId,
      department: input.department,
      domain: input.domain,
      role: 'employee',
      approval_status: 'approved',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single()

  if (error || !profile) {
    throw new Error(error?.message || 'Could not restore employee profile for existing auth user')
  }

  const setupResult = await sendEmployeeSetupEmail(supabase, input.email, input.fullName)
  return {
    profile: profile as Profile,
    warning: setupResult.success ? 'Existing orphaned auth account was re-linked and setup email was sent.' : `Existing orphaned auth account was re-linked, but setup email failed: ${setupResult.error}`,
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
  const redirectTo = getPasswordResetRedirectUrl()
  const normalizedEmail = email.trim().toLowerCase()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, employee_id, role')
    .eq('email', normalizedEmail)
    .maybeSingle()

  let cleanup: AuthCleanupResult
  try {
    cleanup = await cleanupOrphanEmployeeAuthUsersByEmail(supabase, normalizedEmail, {
      preserveProfileId: profile?.id || null,
      reason: 'before_setup_email',
    })
  } catch (error: any) {
    return { success: false, error: error?.message || 'Could not inspect Supabase Auth before setup email' }
  }

  if (cleanup.warnings.length > 0) {
    console.warn('[employee-auth-cleanup] setup preflight warnings', {
      email: normalizedEmail,
      profileId: profile?.id || null,
      warnings: cleanup.warnings,
    })
  }

  const activeAuthUser = cleanup.keptAuthUsers.find((authUser) => authUser.id === profile?.id)
    || cleanup.keptAuthUsers.find((authUser) => authRole(authUser) === 'employee')

  const linkType = activeAuthUser ? 'recovery' : 'invite'
  logAuthCleanup('generating employee setup link', {
    email: normalizedEmail,
    profileId: profile?.id || null,
    authUserId: activeAuthUser?.id || null,
    linkType,
  })

  const { data, error } = await supabase.auth.admin.generateLink({
    type: linkType,
    email: normalizedEmail,
    options: { redirectTo },
  })

  if (error || !data.properties?.action_link) {
    console.warn('[employee-auth-cleanup] setup link generation failed', {
      email: normalizedEmail,
      profileId: profile?.id || null,
      authUserId: activeAuthUser?.id || null,
      linkType,
      code: (error as any)?.code || null,
      message: error?.message || 'missing action link',
    })
    return { success: false, error: error?.message || 'Could not generate verification setup link' }
  }

  const signUpParams = new URLSearchParams({ role: 'employee', email: normalizedEmail })
  if (profile?.employee_id) signUpParams.set('employeeId', profile.employee_id)

  const emailResult = await sendEmail({
    to: normalizedEmail,
    subject: 'Verify and set up your SkillTest_AI account',
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
