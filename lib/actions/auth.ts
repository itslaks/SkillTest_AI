'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { UserRole } from '@/lib/types/database'
import { parseFormData } from '@/lib/security/validation'
import {
  signUpSchema,
  signInSchema,
  magicLinkSchema,
  updateProfileSchema,
} from '@/lib/security/validation'
import { getAuthRedirectUrl, getSiteUrl } from '@/lib/security/env'

export async function signUp(formData: FormData) {
  // Validate and sanitize all inputs
  const parsed = parseFormData(signUpSchema, formData)
  if (!parsed.success) {
    return { error: parsed.error }
  }

  const { email, password, fullName, employeeId, department } = parsed.data

  // Always enforce employee role on sign-up – manager accounts are created by admins only
  const role: UserRole = 'employee'

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options:
      {
        emailRedirectTo: getAuthRedirectUrl(),
        data: {
          full_name: fullName,
          employee_id: employeeId,
          role,
          department,
        },
      }
  })

  if (error) {
    return { error: error.message }
  }

  // After sign up, sync profile full_name if missing
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await syncProfileFromUserMetadata(user.id, user.user_metadata);
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

  const supabase = await createClient()

  // Clear any stale recovery or prior local session state before fresh sign-in.
  await supabase.auth.signOut({ scope: 'local' })

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      return { error: 'Invalid email or password. If you just reset your password, wait a few seconds and try the new password again.' }
    }
    return { error: error.message }
  }

  // Get the profile to check the actual role from database
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  // Use profile role if available, fallback to user_metadata
  const role = profile?.role || data.user?.user_metadata?.role || 'employee'
  const defaultRedirect = role === 'manager' || role === 'admin' ? '/manager' : '/employee'

  return { success: true, redirectTo: redirectTo || defaultRedirect }
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

  const { data: profile, error: profileError } = await supabase
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

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
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
  const supabase = await createClient();
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
  await supabase
    .from('profiles')
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq('id', userId);
}

export async function sendPasswordReset(formData: FormData) {
  const email = formData.get('email') as string;
  if (!email) return { error: 'Email is required' };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/update-password`,
  });
  if (error) return { error: error.message };
  return { success: true };
}
