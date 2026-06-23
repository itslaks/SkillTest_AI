export type OrganizationStatus = 'active' | 'trialing' | 'past_due' | 'suspended' | 'cancelled'
export type OrganizationPlan = 'starter' | 'growth' | 'enterprise'
export type OrganizationMemberRole = 'owner' | 'admin' | 'manager' | 'trainer' | 'member'
export type BillingProvider = 'manual' | 'stripe'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled'
export type SsoProvider = 'saml' | 'oidc' | 'google' | 'azure_ad'
export type SsoStatus = 'draft' | 'active' | 'disabled'

export type OrganizationSummary = {
  id: string
  name: string
  slug: string
  status: OrganizationStatus
  plan: OrganizationPlan
  primary_domain?: string | null
}

export type OrganizationSettings = {
  organization_id: string
  allow_employee_self_signup: boolean
  require_sso: boolean
  default_employee_role: string
  certificate_branding: Record<string, unknown>
  proctoring_policy: Record<string, unknown>
  data_retention_days: number
}

export type BillingSubscription = {
  id: string
  organization_id: string
  provider: BillingProvider
  status: SubscriptionStatus
  plan: string
  seats: number
  current_period_start?: string | null
  current_period_end?: string | null
  cancel_at_period_end: boolean
}

export type SsoConnection = {
  id: string
  organization_id: string
  provider: SsoProvider
  status: SsoStatus
  domain_hint?: string | null
}
