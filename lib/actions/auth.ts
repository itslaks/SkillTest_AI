'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserRole } from '@/lib/types/database'
import { parseFormData } from '@/lib/security/validation'
import {
  signUpSchema,
  signInSchema,
  magicLinkSchema,
  updateProfileSchema,
  passwordResetSchema,
  resendVerificationSchema,
} from '@/lib/security/validation'
import { headers } from 'next/headers'
import {
  AUTH_RATE_LIMIT,
  EMAIL_FLOW_RATE_LIMIT,
  checkIpRateLimit,
  checkKeyRateLimit,
  getClientIp,
  rateLimitMessage,
} from '@/lib/security/rate-limit'
import {
  getAdminLoginEmail,
  getAuthRedirectUrl,
  getPasswordResetRedirectUrl,
  isSupabaseConfigured,
  isSupabaseAdminConfigured,
} from '@/lib/security/env'
import { revalidatePath } from 'next/cache'
import { normalizeDomain } from '@/lib/domain-options'
import { findAuthUsersByEmail, sendEmployeeSetupEmail } from '@/lib/employee-onboarding'
import { sendEmail } from '@/lib/email'

function safeRedirectPath(value: string | undefined | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

/** Client IP for rate-limit keying inside server actions. */
async function getRequestIp(): Promise<string> {
  return getClientIp(await headers())
}

export async function signUp(formData: FormData) {
  // Rate limit account creation per IP (OWASP A07 — mass registration / abuse)
  const signUpRate = checkIpRateLimit(`signup:${await getRequestIp()}`, AUTH_RATE_LIMIT)
  if (!signUpRate.allowed) {
    return { error: rateLimitMessage(signUpRate) }
  }

  // Validate and sanitize all inputs
  const parsed = parseFormData(signUpSchema, formData)
  if (!parsed.success) {
    return { error: parsed.error }
  }

  const { email, password, fullName, employeeId, department, role } = parsed.data
  const domain = normalizeDomain(parsed.data.domain)
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    return { error: 'Supabase is not configured. Add real Supabase URL, anon key, and service role key in .env.local, then restart the dev server.' }
  }

  // Determine approval status:
  // trainers need admin approval; employees get instant access
  const approvalStatus = role === 'trainer' ? 'pending' : 'approved'

  const supabase = await createClient()
  const adminClient = createAdminClient()

  if (role === 'employee') {
    const { data: existingEmployeeProfile, error: existingProfileError } = await adminClient
      .from('profiles')
      .select('id, email, employee_id, role')
      .eq('email', email)
      .maybeSingle()

    if (existingProfileError) {
      return { error: existingProfileError.message }
    }

    if (existingEmployeeProfile) {
      if (existingEmployeeProfile.role !== 'employee') {
        return { error: 'This email is already registered for a staff account. Please sign in or contact an admin.' }
      }

      const existingEmployeeId = String(existingEmployeeProfile.employee_id || '').trim().toLowerCase()
      const enteredEmployeeId = String(employeeId || '').trim().toLowerCase()
      if (existingEmployeeId && existingEmployeeId !== enteredEmployeeId) {
        return { error: 'Employee ID does not match the employee record added by your admin. Please use the same email and Employee ID.' }
      }

      const { error: updateError } = await adminClient
        .from('profiles')
        .update({
          full_name: fullName,
          employee_id: employeeId || existingEmployeeProfile.employee_id || null,
          domain,
          department: department || domain,
          role: 'employee',
          approval_status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingEmployeeProfile.id)

      if (updateError) {
        return { error: updateError.message }
      }

      const setupResult = await sendEmployeeSetupEmail(adminClient, email, fullName)
      if (!setupResult.success) {
        return { error: `Your employee record was found, but we could not send the account setup email: ${setupResult.error}` }
      }

      return {
        success: true,
        redirectTo: `/auth/sign-up-success?email=${encodeURIComponent(email)}&role=employee&setup=resent`,
      }
    }

    const orphanCleanup = await removeOrphanEmployeeAuthUsers(adminClient, email)
    if (orphanCleanup.error) return { error: orphanCleanup.error }
  }

  let authRedirectUrl: string
  try {
    authRedirectUrl = getAuthRedirectUrl()
  } catch (configError: any) {
    console.error('[auth] invalid signup redirect configuration:', configError?.message)
    return { error: 'Authentication email links are not configured correctly. Please contact admin.' }
  }

  const { error, data: signUpData } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authRedirectUrl,
      data: {
        full_name: fullName,
        employee_id: employeeId,
        role,
        domain,
        department,
        approval_status: approvalStatus,
      },
    }
  })

  if (error) {
    console.warn('[auth] signup failed:', error.message)
    return { error: error.message }
  }

  const signUpUser = signUpData?.user as (NonNullable<typeof signUpData.user> & { identities?: unknown[] }) | null
  if (!signUpUser) {
    console.error('[auth] signup returned no user record')
    return { error: 'Account creation failed. Please try again or contact admin.' }
  }

  if (Array.isArray(signUpUser.identities) && signUpUser.identities.length === 0) {
    await supabase.auth.signOut()
    return { error: 'This email is already registered. Please sign in, reset your password, or resend the verification email from the login page.' }
  }

  if ((role === 'employee' || role === 'trainer') && (signUpData.session || signUpUser.email_confirmed_at)) {
    await supabase.auth.signOut()
    console.error('[auth] signup produced a verified/session user before email confirmation; enable Supabase Confirm Email.')
    return { error: 'Email verification is not enabled for signup. Please contact admin before continuing.' }
  }

  await supabase.auth.signOut()

  // After sign up, update the profile with role and approval_status.
  if (signUpData?.user) {
    await adminClient
      .from('profiles')
      .update({
        role: role as UserRole,
        approval_status: approvalStatus,
        full_name: fullName,
        domain,
        department: department || null,
        employee_id: employeeId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', signUpData.user.id)
  }

  if (role === 'trainer') {
    return {
      success: true,
      redirectTo: `/auth/sign-up-success?email=${encodeURIComponent(email)}&role=trainer`
    }
  }

  return { success: true, redirectTo: `/auth/sign-up-success?email=${encodeURIComponent(email)}` }
}

async function removeOrphanEmployeeAuthUsers(adminClient: ReturnType<typeof createAdminClient>, email: string) {
  let authUsers: Awaited<ReturnType<typeof findAuthUsersByEmail>>
  try {
    authUsers = await findAuthUsersByEmail(adminClient, email)
  } catch (error: any) {
    console.warn('[auth] orphan auth lookup failed before signup:', error?.message)
    return { error: 'Could not verify whether this email has an existing account. Please try again or contact admin.' }
  }

  for (const authUser of authUsers) {
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profile) {
      if (profile.role !== 'employee') {
        return { error: `This email is already linked to a ${profile.role} account. Please sign in or contact admin.` }
      }
      continue
    }

    const role = String(authUser.user_metadata?.role || 'employee')
    if (role !== 'employee') {
      return { error: `This email is already linked to a ${role} auth account. Please contact admin.` }
    }

    const { error } = await adminClient.auth.admin.deleteUser(authUser.id)
    if (error) {
      console.warn('[auth] orphan auth delete failed before signup:', error.message)
      return { error: 'This email has an incomplete previous account. Please contact admin to clear it before signing up.' }
    }
  }

  return { success: true }
}

export async function signIn(formData: FormData) {
  // Rate limit sign-in attempts per IP (OWASP A07 — credential brute force)
  const signInRate = checkIpRateLimit(`signin:${await getRequestIp()}`, AUTH_RATE_LIMIT)
  if (!signInRate.allowed) {
    return { error: rateLimitMessage(signInRate) }
  }

  // Validate and sanitize all inputs
  const parsed = parseFormData(signInSchema, formData)
  if (!parsed.success) {
    return { error: parsed.error }
  }

  let { email, password, redirect: redirectTo } = parsed.data

  // Support shorthand for admin
  if (email.toLowerCase() === 'admin' || email.toLowerCase() === 'manager') {
    email = getAdminLoginEmail()
  }

  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    return { error: 'Supabase is not configured. Add real Supabase URL, anon key, and service role key in .env.local, then restart the dev server.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      return { error: 'Invalid email or password. Please check your credentials.' }
    }
    return { error: error.message }
  }

  // Get the profile to check role AND approval_status
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, approval_status')
    .eq('id', data.user.id)
    .single()

  const role = profile?.role || data.user?.user_metadata?.role || 'employee'
  const approvalStatus = profile?.approval_status || 'approved'

  // Email verification gate (OWASP A07): self-registered accounts (employees
  // and trainers) must confirm their email before they can sign in. Staff
  // accounts provisioned by admins are auto-confirmed at creation and are
  // unaffected.
  if ((role === 'employee' || role === 'trainer') && !data.user.email_confirmed_at) {
    await supabase.auth.signOut()
    return {
      error: 'Please verify your email before logging in.',
      needsVerification: true,
      email,
    }
  }

  // Block trainer login if pending approval
  if (role === 'trainer' && approvalStatus === 'pending') {
    await supabase.auth.signOut()
    return { error: 'Your trainer account is pending admin approval. You will be notified once approved.' }
  }

  // Block if rejected
  if (role === 'trainer' && approvalStatus === 'rejected') {
    await supabase.auth.signOut()
    return { error: 'Your trainer account request was rejected. Please contact the admin for more information.' }
  }

  // Role-based redirect
  let defaultRedirect: string
  if (role === 'admin') {
    defaultRedirect = '/manager/admin'
  } else if (role === 'manager' || role === 'training_coordinator') {
    defaultRedirect = '/manager'
  } else if (role === 'trainer') {
    defaultRedirect = '/manager'
  } else {
    defaultRedirect = '/employee'
  }

  return { success: true, redirectTo: safeRedirectPath(redirectTo) || defaultRedirect }
}

export async function signInWithMagicLink(formData: FormData) {
  // Validate and sanitize all inputs
  const parsed = parseFormData(magicLinkSchema, formData)
  if (!parsed.success) {
    return { error: parsed.error }
  }

  const { email, redirect: redirectTo } = parsed.data

  // Rate limit per IP and per target address (mail-bomb mitigation)
  const ipRate = checkIpRateLimit(`magic:${await getRequestIp()}`, EMAIL_FLOW_RATE_LIMIT)
  if (!ipRate.allowed) return { error: rateLimitMessage(ipRate) }
  const emailRate = checkKeyRateLimit(`magic:${email}`, EMAIL_FLOW_RATE_LIMIT)
  if (!emailRate.allowed) return { error: rateLimitMessage(emailRate) }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getAuthRedirectUrl()}${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, message: 'Check your email for the magic link!' }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function getUserProfile() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const adminClient = createAdminClient()
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    return null
  }

  return profile
}

export async function updateProfile(formData: FormData) {
  // Validate and sanitize all inputs
  const parsed = parseFormData(updateProfileSchema, formData)
  if (!parsed.success) {
    return { error: parsed.error }
  }

  const { fullName, department, avatarUrl } = parsed.data
  const employeeId = parsed.data.employeeId?.trim() || null
  const domain = normalizeDomain(parsed.data.domain)

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'employee' && !employeeId) {
    return { error: 'Employee ID is required.' }
  }

  const { error } = await adminClient
    .from('profiles')
    .update({
      full_name: fullName,
      employee_id: employeeId,
      domain,
      department,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function resendVerificationEmail(email: string) {
  // Validate the address before using it (injection / malformed input)
  const parsed = resendVerificationSchema.safeParse({ email })
  if (!parsed.success) {
    return { error: 'Please enter a valid email address.' }
  }
  const normalizedEmail = parsed.data.email

  // Rate limit per IP and per target address (mail-bomb mitigation)
  const ipRate = checkIpRateLimit(`resend:${await getRequestIp()}`, EMAIL_FLOW_RATE_LIMIT)
  if (!ipRate.allowed) return { error: rateLimitMessage(ipRate) }
  const emailRate = checkKeyRateLimit(`resend:${normalizedEmail}`, EMAIL_FLOW_RATE_LIMIT)
  if (!emailRate.allowed) return { error: rateLimitMessage(emailRate) }

  const supabase = await createClient()

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function syncProfileFromUserMetadata(userId: string, userMetadata: any) {
  const supabase = createAdminClient();
  if (!userId || !userMetadata) return;
  // Only update if profile.full_name is null or empty
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();
  if (!profile || profile.full_name) return;
  const fullName = userMetadata.full_name || null;
  if (!fullName) return;
  const update: Record<string, string> = {
    full_name: fullName,
    updated_at: new Date().toISOString(),
  };
  if (userMetadata.domain) update.domain = normalizeDomain(userMetadata.domain);
  await supabase.from('profiles').update(update).eq('id', userId);
}

export async function sendPasswordReset(formData: FormData) {
  // Schema-based validation: strict shape, max length, valid email format
  const parsed = parseFormData(passwordResetSchema, formData)
  if (!parsed.success) {
    return { error: 'Please enter a valid email address.' }
  }
  const normalizedEmail = parsed.data.email

  // Rate limit per IP and per target address (OWASP A07 — abuse of reset flow)
  const ipRate = checkIpRateLimit(`pwreset:${await getRequestIp()}`, EMAIL_FLOW_RATE_LIMIT)
  if (!ipRate.allowed) return { error: rateLimitMessage(ipRate) }
  const emailRate = checkKeyRateLimit(`pwreset:${normalizedEmail}`, EMAIL_FLOW_RATE_LIMIT)
  if (!emailRate.allowed) return { error: rateLimitMessage(emailRate) }

  let resetRedirectUrl: string
  try {
    resetRedirectUrl = getPasswordResetRedirectUrl()
  } catch (configError: any) {
    console.error('[auth] invalid password reset redirect configuration:', configError?.message)
    return { error: 'Password reset email links are not configured correctly. Please contact admin.' }
  }

  if (!isSupabaseAdminConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: resetRedirectUrl,
    });
    if (error) console.warn('[auth] password reset (anon path) failed:', error.message)
    // Anti-enumeration (OWASP A07): always report success so the response
    // does not reveal whether the address has an account.
    return { success: true };
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: normalizedEmail,
    options: {
      redirectTo: resetRedirectUrl,
    },
  })

  if (error || !data?.properties?.action_link) {
    // generateLink fails for unknown addresses (enumeration vector) and for
    // transient admin-API issues. Fall back to Supabase's built-in reset
    // email — it silently no-ops for unknown users — then report generic
    // success either way so account existence is never disclosed.
    console.warn('[auth] generateLink failed, using built-in reset email:', error?.message)
    const supabase = await createClient()
    await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: resetRedirectUrl,
    }).catch(() => undefined)
    return { success: true }
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('full_name')
    .eq('email', normalizedEmail)
    .maybeSingle()

  const resetLink = data.properties.action_link
  const emailResult = await sendEmail({
    to: normalizedEmail,
    subject: 'Reset your SkillTest_AI password',
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:620px;margin:0 auto;padding:24px;background:#f8fafc;">
        <div style="background:#0f172a;color:#fff;padding:24px;border-radius:18px 18px 0 0;">
          <p style="margin:0;color:#5eead4;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">SkillTest_AI Password Reset</p>
          <h1 style="margin:10px 0 0;font-size:24px;">Set a new password</h1>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 18px 18px;">
          <p>Hi ${profile?.full_name || 'Learner'},</p>
          <p>Use the secure link below to set a new password for your SkillTest_AI account.</p>
          <a href="${resetLink}" style="display:inline-block;background:#059669;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700;margin:12px 0;">Reset Password</a>
          <p style="color:#64748b;font-size:13px;">If the button does not work, open this link in your browser:</p>
          <p style="word-break:break-all;color:#334155;font-size:13px;">${resetLink}</p>
          <p style="color:#991b1b;font-size:13px;">For security, use the newest reset email only. Older reset links may expire after a new one is requested.</p>
        </div>
      </div>`,
  })

  if (!emailResult.success) {
    // Operational mail failure — retry through Supabase's built-in sender so
    // the user still gets a reset email, then report generic success.
    console.warn('[auth] custom reset email failed, using built-in reset email:', emailResult.error)
    const supabase = await createClient()
    await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: resetRedirectUrl,
    }).catch(() => undefined)
  }
  return { success: true };
}

// ─── Trainer Approval Actions (called from Admin Console) ─────────────

export async function approveTrainer(userId: string) {
  const adminClient = createAdminClient()

  // Check caller is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: callerProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return { error: 'Only admins can approve trainer accounts' }
  }

  const { error } = await adminClient
    .from('profiles')
    .update({
      approval_status: 'approved',
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/manager/admin')
  return { success: true }
}

export async function rejectTrainer(userId: string, reason?: string) {
  const adminClient = createAdminClient()

  // Check caller is admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: callerProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return { error: 'Only admins can reject trainer accounts' }
  }

  const { error } = await adminClient
    .from('profiles')
    .update({
      approval_status: 'rejected',
      rejection_reason: reason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/manager/admin')
  return { success: true }
}
