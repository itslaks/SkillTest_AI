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

  const { email, password, fullName, employeeId, role, department } = parsed.data

  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: {
        full_name: fullName,
        employee_id: employeeId,
        role,
        department,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect(`/auth/sign-up-success?email=${encodeURIComponent(email)}`)
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

  console.log('[Auth Debug] Signing in with:', email)

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('[Auth Debug] Sign-in error:', error.message)
    return { error: error.message }
  }

  const role = data.user?.user_metadata?.role || 'employee'
  const defaultRedirect = role === 'manager' || role === 'admin' ? '/manager' : '/employee'
  
  redirect(redirectTo || defaultRedirect)
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
