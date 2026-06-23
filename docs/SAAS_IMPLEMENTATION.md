# SaaS Implementation Foundation

This repository now includes the first production-safe SaaS foundation while preserving existing single-tenant behavior.

## Build 1 - Tenant, Billing, And SSO Foundation

Migration `049_saas_tenant_billing_sso_foundation.sql` adds:

- `organizations`
- `organization_members`
- `organization_domains`
- `organization_settings`
- `billing_customers`
- `billing_subscriptions`
- `sso_connections`

It also adds nullable `organization_id` links to core tables such as `profiles`, `quizzes`, `quiz_attempts`, `training_batches`, `training_sessions`, and `training_notifications`.

The links are nullable by design. Existing data continues to work, and new SaaS flows can opt in to organization scoping without a risky forced migration.

## Build 2 - Manager Data Typing Foundation

`lib/manager-data-types.ts` provides shared row/reference types and relation helpers for the larger manager pages. Use these types when refactoring `manager/operations`, `manager/integrity`, admin screens, and dashboard-heavy components away from `any`.

## Build 3 - Proctoring Validation Foundation

Migration `050_proctoring_validation_program.sql` adds:

- `proctoring_validation_studies`
- `proctoring_validation_runs`

These tables capture real-device validation runs, expected scenarios, observed outcomes, and generated false-positive/false-negative flags.

`lib/proctoring-validation.ts` includes summary helpers for precision and recall. This supports a measured rollout instead of relying on unvalidated proctoring claims.

## Remaining Production Work

- Backfill existing rows into organizations after the first production tenant is created.
- Apply organization filters to all manager, employee, report, export, and API queries.
- Wire billing provider webhooks and checkout/customer portal flows.
- Implement SSO login routing and metadata validation for SAML/OIDC.
- Replace remaining `any` usages in `manager/operations`, `manager/integrity`, and admin screens using the shared manager data types.
- Run proctoring validation studies across target browsers, lighting conditions, devices, and network profiles.
