import test from 'node:test'
import assert from 'node:assert/strict'

import { sendMandatoryBrdEmailCore } from '../lib/brd-notifications-core.ts'

test('quiz assignment BRD email creates a log row and marks sent when provider succeeds', async () => {
  const admin = createFakeBrdEmailAdmin()
  const result = await sendMandatoryBrdEmailCore({
    admin: admin as any,
    eventType: 'quiz_assigned',
    to: 'employee@example.com',
    recipientRole: 'employee',
    subject: 'New quiz assigned: SQL',
    html: '<p>SQL</p>',
    text: 'SQL',
    configuration: { valid: true, provider: 'smtp', errors: [], warnings: [] },
    transport: async () => ({ success: true }),
  })

  assert.equal(result.success, true)
  assert.equal(admin.inserted.length, 1)
  assert.equal(admin.inserted[0].event_type, 'quiz_assigned')
  assert.equal(admin.inserted[0].recipient_email, 'employee@example.com')
  assert.equal(admin.updates[0].status, 'sent')
  assert.equal(admin.updates[0].error_message, null)
  assert.ok(admin.updates[0].sent_at)
})

test('quiz assignment BRD email marks failed and stores provider error when send fails', async () => {
  const admin = createFakeBrdEmailAdmin()
  const result = await sendMandatoryBrdEmailCore({
    admin: admin as any,
    eventType: 'quiz_assigned',
    to: 'employee@example.com',
    recipientRole: 'employee',
    subject: 'New quiz assigned: SQL',
    html: '<p>SQL</p>',
    configuration: { valid: true, provider: 'resend', errors: [], warnings: [] },
    transport: async () => ({ success: false, error: 'provider rejected message' }),
  })

  assert.equal(result.success, false)
  assert.equal(admin.inserted.length, 1)
  assert.equal(admin.updates[0].status, 'failed')
  assert.equal(admin.updates[0].provider, 'resend')
  assert.equal(admin.updates[0].error_message, 'provider rejected message')
})

test('quiz assignment BRD email marks failed when mandatory provider config is missing', async () => {
  const admin = createFakeBrdEmailAdmin()
  const result = await sendMandatoryBrdEmailCore({
    admin: admin as any,
    eventType: 'quiz_assigned',
    to: 'employee@example.com',
    recipientRole: 'employee',
    subject: 'New quiz assigned: SQL',
    html: '<p>SQL</p>',
    configuration: { valid: false, provider: 'none', errors: ['SMTP or Resend is missing.'], warnings: [] },
    transport: async () => {
      throw new Error('transport should not be called')
    },
  })

  assert.equal(result.success, false)
  assert.equal(admin.inserted.length, 1)
  assert.equal(admin.updates[0].status, 'failed')
  assert.equal(admin.updates[0].error_message, 'SMTP or Resend is missing.')
})

test('session allocation BRD email creates one auditable delivery row', async () => {
  const admin = createFakeBrdEmailAdmin()
  const result = await sendMandatoryBrdEmailCore({
    admin: admin as any,
    eventType: 'session_allocated',
    to: 'trainer@example.com',
    recipientRole: 'trainer',
    relatedBatchId: '11111111-1111-4111-8111-111111111111',
    relatedNotificationId: '22222222-2222-4222-8222-222222222222',
    subject: 'Training session allocated: SQL Window Functions',
    html: '<p>Session allocated</p>',
    text: 'Session allocated',
    configuration: { valid: true, provider: 'smtp', errors: [], warnings: [] },
    transport: async () => ({ success: true }),
  })

  assert.equal(result.success, true)
  assert.equal(admin.inserted.length, 1)
  assert.equal(admin.inserted[0].event_type, 'session_allocated')
  assert.equal(admin.inserted[0].recipient_email, 'trainer@example.com')
  assert.equal(admin.inserted[0].recipient_role, 'trainer')
  assert.equal(admin.inserted[0].related_batch_id, '11111111-1111-4111-8111-111111111111')
  assert.equal(admin.inserted[0].related_notification_id, '22222222-2222-4222-8222-222222222222')
  assert.equal(admin.updates[0].status, 'sent')
})

test('mandatory BRD email marks failed when provider throws', async () => {
  const admin = createFakeBrdEmailAdmin()
  const result = await sendMandatoryBrdEmailCore({
    admin: admin as any,
    eventType: 'session_allocated',
    to: 'trainer@example.com',
    recipientRole: 'trainer',
    subject: 'Training session allocated: SQL Window Functions',
    html: '<p>Session allocated</p>',
    configuration: { valid: true, provider: 'smtp', errors: [], warnings: [] },
    transport: async () => {
      throw new Error('SMTP connection reset')
    },
  })

  assert.equal(result.success, false)
  assert.equal(result.error, 'SMTP connection reset')
  assert.equal(admin.updates[0].status, 'failed')
  assert.equal(admin.updates[0].error_message, 'SMTP connection reset')
})

function createFakeBrdEmailAdmin() {
  const state = {
    inserted: [] as any[],
    updates: [] as any[],
  }

  return {
    ...state,
    from(table: string) {
      assert.equal(table, 'brd_email_notification_logs')
      return {
        insert(row: any) {
          state.inserted.push(row)
          return {
            select() {
              return {
                async maybeSingle() {
                  return { data: { id: 'log-1' }, error: null }
                },
              }
            },
          }
        },
        update(row: any) {
          state.updates.push(row)
          return {
            async eq(column: string, value: string) {
              assert.equal(column, 'id')
              assert.equal(value, 'log-1')
              return { error: null }
            },
          }
        },
      }
    },
  }
}
