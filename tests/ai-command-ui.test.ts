import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

test('AI Command exposes numbered quiz launchpad with structured assignment controls', () => {
  const consoleSource = read('components/manager/ai-command-console.tsx')
  assert.match(consoleSource, /Quiz Launchpad/)
  assert.match(consoleSource, /Step \{step\} of 4/)
  assert.match(consoleSource, /Create \+ assign/)
  assert.match(consoleSource, /Assign existing/)
  assert.match(consoleSource, /selectedEmails/)
  assert.match(consoleSource, /Build confirmation preview/)
  assert.match(consoleSource, /Scheduling training session/)
  assert.match(consoleSource, /run update session/)
  assert.match(consoleSource, /run delete session/)
})

test('floating AI Command preserves previews and can confirm quiz assignment', () => {
  const chatbotSource = read('components/manager/manager-command-chatbot.tsx')
  assert.match(chatbotSource, /preview:\s*payload\.preview/)
  assert.match(chatbotSource, /confirmToken:\s*preview\.confirmToken/)
  assert.match(chatbotSource, /decidePreview\(entry\.preview!, 'confirm'\)/)
  assert.match(chatbotSource, /Creating training batch/)
  assert.match(chatbotSource, /Scheduling training session/)
  assert.doesNotMatch(chatbotSource, /Working on live data/)
})

test('create quiz command accepts structured bulk recipient arguments', () => {
  const routeSource = read('app/api/manager-chatbot/route.ts')
  assert.match(routeSource, /args\.employee_emails/)
  assert.match(routeSource, /args\.employees/)
  assert.match(routeSource, /createQuizAssignmentsAndNotify/)
})

test('AI Command answers scoped employee-count prompts deterministically', () => {
  const routeSource = read('app/api/manager-chatbot/route.ts')
  assert.match(routeSource, /summarizeRosterCount\(message, data\)/)
  assert.match(routeSource, /Employees in your current training scope/)
  assert.match(routeSource, /Visible employee profiles/)
  assert.match(routeSource, /Sessions assigned in your current scope/)
  assert.match(routeSource, /Trainer-linked sessions/)
})

test('training session creation syncs trainer, learner attendance, meeting links, and notifications', () => {
  const syncSource = read('lib/training-session-sync.ts')
  const trainingActions = read('lib/actions/training.ts')
  const chatbotRoute = read('app/api/manager-chatbot/route.ts')
  const candidateImport = read('app/api/training/batch-candidate-import/route.ts')
  const migration = read('database/migrations/053_training_session_meeting_links.sql')
  const accessSource = read('lib/training-access.ts')
  const sessionForm = read('components/manager/session-allocation-form.tsx')
  const operationsPage = read('app/manager/operations/page.tsx')

  assert.match(syncSource, /syncTrainingSessionVisibility/)
  assert.match(syncSource, /training_batch_trainers/)
  assert.match(syncSource, /session_attendance/)
  assert.match(syncSource, /buildSessionAllocationEmail/)
  assert.match(syncSource, /recipient_role: 'employee'/)
  assert.match(syncSource, /recipient_role: 'trainer'/)
  assert.match(migration, /meeting_url TEXT/)
  assert.match(accessSource, /from\('training_sessions'\)/)
  assert.match(trainingActions, /syncTrainingSessionVisibility/)
  assert.match(trainingActions, /meeting_url: meetingUrl/)
  assert.match(trainingActions, /validateTrainerSessionLearners/)
  assert.match(chatbotRoute, /syncTrainingSessionVisibility/)
  assert.match(chatbotRoute, /args\.meeting_url/)
  assert.match(chatbotRoute, /validateTrainerSessionLearnersForCommand/)
  assert.match(sessionForm, /employeesByTrainer/)
  assert.match(sessionForm, /Showing only employees assigned under/)
  assert.match(operationsPage, /trainerEmployeeAssignments/)
  assert.match(operationsPage, /Create session/)
  assert.match(operationsPage, /Delete/)
  assert.match(candidateImport, /backfillAttendanceForBatchMembers/)
})
