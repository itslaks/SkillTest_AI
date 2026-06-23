import { createAdminClient } from '@/lib/supabase/server'
import type { OrganizationSummary } from '@/lib/saas/types'

export type TenantContext = {
  userId: string
  organizationId: string | null
  organizations: OrganizationSummary[]
}

export async function getTenantContext(userId: string): Promise<TenantContext> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('organization_members')
    .select('organization:organization_id(id, name, slug, status, plan, primary_domain)')
    .eq('user_id', userId)
    .eq('status', 'active')

  const organizations: OrganizationSummary[] = (data || [])
    .map((row) => toOrganizationSummary(firstRelation(row.organization)))
    .filter((organization): organization is OrganizationSummary => Boolean(organization))

  return {
    userId,
    organizationId: organizations[0]?.id || null,
    organizations,
  }
}

export function requireTenantId(context: TenantContext): string {
  if (!context.organizationId) {
    throw new Error('Organization context is required for this SaaS operation.')
  }
  return context.organizationId
}

function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (Array.isArray(relation)) return relation[0] || null
  return relation || null
}

function toOrganizationSummary(value: unknown): OrganizationSummary | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || typeof row.name !== 'string' || typeof row.slug !== 'string') return null
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status === 'trialing' || row.status === 'past_due' || row.status === 'suspended' || row.status === 'cancelled'
      ? row.status
      : 'active',
    plan: row.plan === 'growth' || row.plan === 'enterprise' ? row.plan : 'starter',
    primary_domain: typeof row.primary_domain === 'string' ? row.primary_domain : null,
  }
}
