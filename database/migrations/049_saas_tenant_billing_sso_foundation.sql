-- SaaS foundation: tenant organizations, org membership, billing, and SSO metadata.
-- Existing single-tenant data remains valid because new organization links are nullable.

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'suspended', 'cancelled')),
  plan TEXT NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'growth', 'enterprise')),
  primary_domain TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'manager', 'trainer', 'member')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'suspended')),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.organization_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'failed')),
  verification_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, domain),
  UNIQUE (domain)
);

CREATE TABLE IF NOT EXISTS public.organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  allow_employee_self_signup BOOLEAN NOT NULL DEFAULT FALSE,
  require_sso BOOLEAN NOT NULL DEFAULT FALSE,
  default_employee_role TEXT NOT NULL DEFAULT 'employee',
  certificate_branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  proctoring_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_retention_days INTEGER NOT NULL DEFAULT 365 CHECK (data_retention_days >= 30),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_customers (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'stripe')),
  provider_customer_id TEXT,
  billing_email TEXT,
  tax_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_customer_id)
);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'stripe')),
  provider_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'paused', 'cancelled')),
  plan TEXT NOT NULL DEFAULT 'starter',
  seats INTEGER NOT NULL DEFAULT 25 CHECK (seats > 0),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_subscription_id)
);

CREATE TABLE IF NOT EXISTS public.sso_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('saml', 'oidc', 'google', 'azure_ad')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'disabled')),
  domain_hint TEXT,
  entity_id TEXT,
  sso_url TEXT,
  certificate_fingerprint TEXT,
  oidc_issuer TEXT,
  oidc_client_id TEXT,
  encrypted_client_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.training_batches ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.training_notifications ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_organization_id ON public.quizzes(organization_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_organization_id ON public.quiz_attempts(organization_id);
CREATE INDEX IF NOT EXISTS idx_training_batches_organization_id ON public.training_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_organization_id ON public.training_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_training_notifications_organization_id ON public.training_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_org_status ON public.billing_subscriptions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_sso_connections_org_status ON public.sso_connections(organization_id, status);

CREATE OR REPLACE FUNCTION public.current_user_organization_ids()
RETURNS UUID[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(organization_id), ARRAY[]::UUID[])
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.is_organization_member(target_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_organization_id = ANY(public.current_user_organization_ids());
$$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sso_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_member_select ON public.organizations;
CREATE POLICY organizations_member_select ON public.organizations
FOR SELECT USING (public.is_organization_member(id));

DROP POLICY IF EXISTS organization_members_self_select ON public.organization_members;
CREATE POLICY organization_members_self_select ON public.organization_members
FOR SELECT USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS organization_settings_member_select ON public.organization_settings;
CREATE POLICY organization_settings_member_select ON public.organization_settings
FOR SELECT USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS organization_domains_member_select ON public.organization_domains;
CREATE POLICY organization_domains_member_select ON public.organization_domains
FOR SELECT USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS billing_member_select ON public.billing_customers;
CREATE POLICY billing_member_select ON public.billing_customers
FOR SELECT USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS subscriptions_member_select ON public.billing_subscriptions;
CREATE POLICY subscriptions_member_select ON public.billing_subscriptions
FOR SELECT USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS sso_member_select ON public.sso_connections;
CREATE POLICY sso_member_select ON public.sso_connections
FOR SELECT USING (public.is_organization_member(organization_id));
