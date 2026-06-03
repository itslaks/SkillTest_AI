import { NextResponse } from 'next/server'
import { isSupabaseAdminConfigured, isSupabaseConfigured } from '@/lib/security/env'

export async function GET() {
  const checks = {
    supabaseUrl: isConfiguredValue(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: isConfiguredValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: isConfiguredValue(process.env.SUPABASE_SERVICE_ROLE_KEY),
  }

  const allConfigured = isSupabaseConfigured() && isSupabaseAdminConfigured()

  return NextResponse.json({
    status: allConfigured ? 'healthy' : 'missing_config',
    checks,
    message: allConfigured 
      ? 'All environment variables are configured' 
      : 'Some environment variables are missing. Check your .env.local file.',
  })
}

function isConfiguredValue(value: string | undefined) {
  return Boolean(value && !value.toLowerCase().includes('your'))
}
