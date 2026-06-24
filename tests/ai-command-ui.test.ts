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
})

test('floating AI Command preserves previews and can confirm quiz assignment', () => {
  const chatbotSource = read('components/manager/manager-command-chatbot.tsx')
  assert.match(chatbotSource, /preview:\s*payload\.preview/)
  assert.match(chatbotSource, /confirmToken:\s*preview\.confirmToken/)
  assert.match(chatbotSource, /decidePreview\(entry\.preview!, 'confirm'\)/)
})

test('create quiz command accepts structured bulk recipient arguments', () => {
  const routeSource = read('app/api/manager-chatbot/route.ts')
  assert.match(routeSource, /args\.employee_emails/)
  assert.match(routeSource, /args\.employees/)
  assert.match(routeSource, /createQuizAssignmentsAndNotify/)
})
