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
} from '@/lib/security/validation'
import { getAuthRedirectUrl, getSiteUrl, isSupabaseConfigured, isSupabaseAdminConfigured } from '@/lib/security/env'
import { revalidatePath } from 'next/cache'
import { normalizeDomain } from '@/lib/domain-options'

function safeRedirectPath(value: string | undefined | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export async function signUp(formData: FormData) {
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

  const { error, data: signUpData } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
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
    return { error: error.message }
  }

  // After sign up, update the profile with role and approval_status
  if (signUpData?.user) {
    const adminClient = createAdminClient()
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

export async function signIn(formData: FormData) {
  // Validate and sanitize all inputs
  const parsed = parseFormData(signInSchema, formData)
  if (!parsed.success) {
    return { error: parsed.error }
  }

  let { email, password, redirect: redirectTo } = parsed.data

  // Support shorthand for admin
  if (email.toLowerCase() === 'admin' || email.toLowerCase() === 'manager') {
    email = 'admin@hexaware.com'
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
  const domain = normalizeDomain(parsed.data.domain)

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('profiles')
    .update({
      full_name: fullName,
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
  const supabase = await createClient()

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
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
  const email = formData.get('email') as string;
  if (!email) return { error: 'Email is required' };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/auth/update-password`,
  });
  if (error) return { error: error.message };
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
