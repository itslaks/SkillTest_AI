import test from 'node:test'
import assert from 'node:assert/strict'

import {
  classifyCopilotIntent,
  extractQuizCreationIntent,
  resolveAdminCommand,
} from '../lib/ai-command-parser.ts'

test('AI Command understands broken-English quiz creation prompts', () => {
  const command = resolveAdminCommand('plz make hard python quiz 12 mcq give to Ram by tomorrow enable AI proctoring certificate above 20%')

  assert.equal(command?.action, 'create quiz')
  assert.equal(command?.source, 'natural')
  assert.equal(command?.args.topic, 'python')
  assert.equal(command?.args.title, 'python Assessment')
  assert.equal(command?.args.difficulty, 'hard')
  assert.equal(command?.args.question_count, '12')
  assert.equal(command?.args.assigned_to, 'Ram')
  assert.equal(command?.args.due_date, 'tomorrow')
  assert.equal(command?.args.proctoring_required, 'true')
  assert.equal(command?.args.certificate_min_score, '20')
})

test('AI Command extracts loose quiz details without requiring perfect grammar', () => {
  const intent = extractQuizCreationIntent('prepare assessment about cyber security 25 qs medium pass score 75 before friday')

  assert.equal(intent.topic, 'cyber security')
  assert.equal(intent.title, 'cyber security Assessment')
  assert.equal(intent.question_count, '25')
  assert.equal(intent.difficulty, 'medium')
  assert.equal(intent.passing_score, '75')
  assert.equal(intent.due_date, 'friday')
})

test('AI Command extracts complete natural quiz command with multi-name assignment', () => {
  const command = resolveAdminCommand('create quiz on the topic of sql window functions and assign it to lakshan, bala aditya, ashutosh assign certificate if the employee score more than 20%, 10 questions should be created in hard difficulty and enable AI proctoring')

  assert.equal(command?.action, 'create quiz')
  assert.equal(command?.args.topic, 'sql window functions')
  assert.equal(command?.args.title, 'sql window functions Assessment')
  assert.equal(command?.args.assigned_to, 'lakshan, bala aditya, ashutosh')
  assert.equal(command?.args.question_count, '10')
  assert.equal(command?.args.difficulty, 'hard')
  assert.equal(command?.args.certificate_enabled, 'true')
  assert.equal(command?.args.certificate_min_score, '20')
  assert.equal(command?.args.proctoring_required, 'true')
})

test('AI Command keeps explicit admin command key-values intact', () => {
  const command = resolveAdminCommand('run create employee email=ram@example.com name="Ram Kumar" employee_id=E123 domain=Java')

  assert.equal(command?.action, 'create employee')
  assert.equal(command?.source, 'explicit')
  assert.deepEqual(command?.args, {
    email: 'ram@example.com',
    name: 'Ram Kumar',
    employee_id: 'E123',
    domain: 'Java',
  })
})

test('AI Command recognizes destructive natural-language training cleanup', () => {
  const command = resolveAdminCommand('please remove all training data now')

  assert.equal(command?.action, 'clear training')
  assert.equal(command?.args.confirmation, 'DELETE TRAINING')
})

test('AI Command classifies messy operational and reporting prompts', () => {
  assert.equal(classifyCopilotIntent('pls send reminder for low score people'), 'OPERATIONAL_ACTION')
  assert.equal(classifyCopilotIntent('need compliance summary this month'), 'REPORT_GENERATION')
  assert.equal(classifyCopilotIntent('why certificate not issued for ram'), 'SYSTEM_EXPLANATION')
  assert.equal(classifyCopilotIntent('who weak in java batch'), 'DATA_ANALYSIS')
})
