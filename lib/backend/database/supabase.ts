import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function createRequestDbClient() {
  return createClient()
}

export function createServiceDbClient() {
  return createAdminClient()
}

export async function createReportDbClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createServiceDbClient()
  }

  return createRequestDbClient()
}
