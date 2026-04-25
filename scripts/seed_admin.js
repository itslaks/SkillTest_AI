const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

function loadLocalEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
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

loadLocalEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables. Check .env.local.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function seedAdmin() {
  const email = 'admin@hexaware.com'
  const password = 'Zxcv,0987'
  
  console.log(`Checking if admin account exists: ${email}...`)
  
  const { data: users, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Error listing users:', listError)
    return
  }
  
  let user = users.users.find(u => u.email === email)
  
  if (!user) {
    console.log('Creating admin account...')
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'Admin Manager',
        role: 'manager',
        domain: 'Administration'
      }
    })
    
    if (createError) {
      console.error('Error creating admin account:', createError)
      return
    }
    user = newUser.user
    console.log('Admin account created successfully.')
  } else {
    console.log('Admin account already exists. Updating password and confirming...')
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { 
        password,
        email_confirm: true,
        user_metadata: {
          ...user.user_metadata,
          full_name: 'Admin Manager',
          role: 'manager',
          domain: 'Administration'
        },
        app_metadata: {
          ...user.app_metadata,
          role: 'manager'
        }
      }
    )
    if (updateError) {
      console.error('Error updating admin password:', updateError)
    } else {
      console.log('Admin password/status updated.')
    }
  }

  // Ensure profile exists and has manager role
  if (user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email,
        full_name: 'Admin Manager',
        role: 'manager',
        domain: 'Administration'
      }, { onConflict: 'id' })
    
    if (profileError) {
      console.error('Error updating admin profile:', profileError)
    } else {
      console.log('Admin profile verified/updated.')
    }
  }
}

seedAdmin()
