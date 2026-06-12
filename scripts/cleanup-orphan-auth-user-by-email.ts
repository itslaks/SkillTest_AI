import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  const env = fs.readFileSync(envPath, 'utf8')
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...valueParts] = trimmed.split('=')
    if (!process.env[key]) {
      process.env[key] = valueParts.join('=').replace(/^["']|["']$/g, '')
    }
  }
}

async function findAuthUsersByEmail(supabase: any, email: string) {
  const target = email.trim().toLowerCase()
  const matches: any[] = []
  const perPage = 1000

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Auth user lookup failed: ${error.message}`)

    for (const user of data.users || []) {
      if (user.email?.trim().toLowerCase() === target) matches.push(user)
    }

    if (!data.users || data.users.length < perPage) break
  }

  return matches
}

async function main() {
  loadLocalEnv()

  const email = process.argv[2]?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage: npm run cleanup:auth-user -- employee@example.com')
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`[cleanup] Searching Supabase Auth for ${email}`)
  const authUsers = await findAuthUsersByEmail(supabase, email)
  if (authUsers.length === 0) {
    console.log('[cleanup] PASS: no Supabase Auth users found for this email.')
    return
  }

  let deleted = 0
  let kept = 0

  for (const authUser of authUsers) {
    const role = String(authUser.user_metadata?.role || 'employee')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileError) {
      kept++
      console.warn(`[cleanup] KEEP auth=${authUser.id}: profile lookup failed: ${profileError.message}`)
      continue
    }

    if (profile) {
      kept++
      console.log(`[cleanup] KEEP auth=${authUser.id}: active profile exists role=${profile.role} email=${profile.email}`)
      continue
    }

    if (role !== 'employee') {
      kept++
      console.log(`[cleanup] KEEP auth=${authUser.id}: no profile, but metadata role=${role}`)
      continue
    }

    const { error } = await supabase.auth.admin.deleteUser(authUser.id)
    if (error) {
      kept++
      console.warn(`[cleanup] FAIL auth=${authUser.id}: ${error.message}`)
      continue
    }

    deleted++
    console.log(`[cleanup] DELETED orphan employee auth user auth=${authUser.id}`)
  }

  const remaining = await findAuthUsersByEmail(supabase, email)
  console.log(`[cleanup] Done. found=${authUsers.length} deleted=${deleted} kept=${kept} remaining=${remaining.length}`)
  if (remaining.length > 0) {
    console.log('[cleanup] Remaining users are active profiles or non-employee auth accounts.')
  }
}

main().catch((error) => {
  console.error('[cleanup] ERROR:', error?.message || error)
  process.exit(1)
})
