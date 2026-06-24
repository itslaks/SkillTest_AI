import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import path from 'node:path'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file: string) => fs.existsSync(path.join(root, file))

test('BRD mandatory email delivery has audit table, service, and retry route', () => {
  const migration = read('database/migrations/052_brd_email_delivery_logs.sql')
  assert.match(migration, /brd_email_notification_logs/)
  assert.match(migration, /event_type/)
  assert.match(migration, /recipient_email/)
  assert.match(migration, /status public\.brd_email_status/)
  assert.match(read('lib/brd-notifications.ts'), /sendMandatoryBrdEmail/)
  assert.match(read('lib/brd-notifications.ts'), /retryFailedBrdEmailNotifications/)
  assert.ok(exists('app/api/cron/retry-brd-email/route.ts'))
  assert.ok(exists('app/api/admin/email-test/route.ts'))
})

test('BRD health and readiness endpoints exist with email and storage checks', () => {
  assert.ok(exists('app/api/health/route.ts'))
  assert.ok(exists('app/api/ready/route.ts'))
  const readiness = read('lib/readiness.ts')
  assert.match(readiness, /validateEmailConfiguration/)
  assert.match(readiness, /storage\.listBuckets/)
  assert.match(readiness, /profiles/)
})

test('BRD Excel upload and dashboard benchmarks are scripted', () => {
  assert.ok(exists('scripts/generate-brd-upload-fixtures.mjs'))
  assert.ok(exists('scripts/validate-brd-upload-scale.mjs'))
  assert.ok(exists('scripts/benchmark-dashboard-load.mjs'))
  const pkg = read('package.json')
  assert.match(pkg, /brd:upload-benchmark/)
  assert.match(pkg, /brd:dashboard-benchmark/)
})

test('per-quiz topic performance visualization is wired', () => {
  assert.ok(exists('components/manager/quiz-topic-performance-chart.tsx'))
  const page = read('app/manager/quizzes/[id]/page.tsx')
  assert.match(page, /QuizTopicPerformanceChart/)
  assert.match(page, /buildQuestionPerformance/)
})
