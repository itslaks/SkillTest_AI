# Deployment Readiness

## Uptime Target

The BRD target is 99.5% uptime. Code alone cannot prove uptime, so production must measure it with external monitoring.

## Required Environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_ALERT_EMAIL`
- One email provider:
  - `RESEND_API_KEY`, or
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `EMAIL_FROM`
- `CRON_SECRET`

Production validation fails loudly when mandatory email configuration is missing.

## Health Endpoints

- `/api/health`: structured health response for environment, database, email, and storage.
- `/api/ready`: readiness response suitable for deployment and uptime monitors.
- `/api/cron/training-governance`: scheduled BRD notification sweeps.
- `/api/cron/retry-brd-email`: retry failed mandatory emails after provider recovery.
- `/api/admin/email-test`: admin-only provider test email endpoint.

## Monitoring Checklist

1. Monitor `/api/ready` every 1 minute.
2. Alert if two consecutive checks return HTTP 503.
3. Track monthly uptime as successful checks divided by total checks.
4. Alert when projected monthly uptime falls below 99.5%.
5. Run the governance cron at least every 15 minutes during training hours.
6. Run failed BRD email retry every 15 minutes.
7. Review admin diagnostics daily for failed mandatory email delivery.

## Release Checklist

1. Apply all database migrations.
2. Run `npm run brd:upload-benchmark`.
3. Run `npm run brd:dashboard-benchmark`.
4. Run `npm run test`.
5. Run `npm run build`.
6. Open `/manager/diagnostics` and verify email, database, notification, and BRD email checks.
7. Send a real test email through `/api/admin/email-test`.
8. Confirm storage bucket visibility in `/api/ready`.

## Remaining Risk

External service outages, provider limits, and hosting incidents are operational risks. The app now provides readiness and retry mechanisms, but production uptime depends on deployment monitoring and incident response.
