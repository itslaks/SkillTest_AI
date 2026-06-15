import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { count, error } = await supabase
  .from('profiles')
  .update({ avatar_url: 'avatar3d:avatar-01', updated_at: new Date().toISOString() }, { count: 'exact' })
  .eq('role', 'employee')

if (error) {
  console.error(`Failed to update employee avatars: ${error.message}`)
  process.exit(1)
}

console.log(`Set avatar3d:avatar-01 for ${count ?? 0} employee profile(s).`)
