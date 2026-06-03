'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function getVisibleProfiles(query = '') {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: 'Not authenticated', data: [] }

  const admin = createAdminClient()
  const term = query.trim()
  let profileQuery = admin
    .from('profiles')
    .select('id, full_name, email, employee_id, department, domain, role, avatar_url')
    .order('full_name', { ascending: true })
    .limit(80)

  if (term) {
    const safe = term.replace(/[%_,]/g, '')
    profileQuery = profileQuery.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%,employee_id.ilike.%${safe}%,domain.ilike.%${safe}%,department.ilike.%${safe}%`)
  }

  const { data, error: profileError } = await profileQuery
  if (profileError) return { error: profileError.message, data: [] }
  return { data: data || [] }
}

export async function getProfileDashboard(profileId: string) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/auth/login')

  const admin = createAdminClient()
  const [
    profileRes,
    statsRes,
    attemptsRes,
    badgesRes,
    assignmentsRes,
    membershipsRes,
    attendanceRes,
    certificatesRes,
  ] = await Promise.all([
    admin.from('profiles').select('*').eq('id', profileId).maybeSingle(),
    admin.from('user_stats').select('*').eq('user_id', profileId).maybeSingle(),
    admin
      .from('quiz_attempts')
      .select('*, quizzes:quiz_id(id, title, topic, difficulty, passing_score)')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false })
      .limit(30),
    admin
      .from('user_badges')
      .select('earned_at, badges(*)')
      .eq('user_id', profileId)
      .order('earned_at', { ascending: false })
      .limit(40),
    admin
      .from('quiz_assignments')
      .select('assigned_at, quizzes:quiz_id(id, title, topic, difficulty, is_active)')
      .eq('user_id', profileId)
      .order('assigned_at', { ascending: false })
      .limit(20),
    admin
      .from('batch_members')
      .select('*, batch:batch_id(id, title, domain, status, start_date, end_date)')
      .eq('user_id', profileId)
      .order('joined_at', { ascending: false })
      .limit(20),
    admin
      .from('session_attendance')
      .select('status, check_in_time, updated_at, session:session_id(title, session_date, batch_id)')
      .eq('user_id', profileId)
      .order('updated_at', { ascending: false })
      .limit(50),
    admin
      .from('certificates')
      .select('*, quiz:quiz_id(title, topic), rule:rule_id(certificate_name, template_image_url, template_accent_color, template_notes)')
      .eq('user_id', profileId)
      .order('issued_at', { ascending: false })
      .limit(20),
  ])

  if (!profileRes.data) return { error: 'Profile not found' }

  return {
    data: {
      profile: profileRes.data,
      stats: statsRes.data,
      attempts: attemptsRes.data || [],
      badges: badgesRes.data || [],
      assignments: assignmentsRes.data || [],
      memberships: membershipsRes.data || [],
      attendance: attendanceRes.data || [],
      certificates: certificatesRes.data || [],
    },
  }
}
