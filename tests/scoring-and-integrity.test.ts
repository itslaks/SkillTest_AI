import test from 'node:test'
import assert from 'node:assert/strict'

import {
  averageScore,
  computeTopperScore,
  isTopper,
  normalizeTopperWeights,
} from '../lib/topper.ts'
import {
  calculateProctoringRisk,
  getProctoringRiskLevel,
  shouldAutoSubmitForIntegrity,
} from '../lib/proctoring.ts'
import { summarizeProctoringValidation } from '../lib/proctoring-validation.ts'
import type { ProctoringEvent } from '../lib/types/database.ts'

test('averageScore ignores nullish and non-finite values', () => {
  assert.equal(averageScore([80, null, undefined, Number.NaN, 100]), 90)
  assert.equal(averageScore([null, undefined, Number.NaN]), 0)
})

test('computeTopperScore respects attendance eligibility and configured weights', () => {
  assert.equal(
    computeTopperScore({
      assessmentAvg: 90,
      projectScore: 70,
      attendancePct: 80,
      weights: { assessment: 70, project: 30, minAttendance: 75 },
    }),
    84,
  )

  assert.equal(
    computeTopperScore({
      assessmentAvg: 100,
      projectScore: 100,
      attendancePct: 74,
      weights: { assessment: 70, project: 30, minAttendance: 75 },
    }),
    0,
  )
})

test('normalizeTopperWeights falls back only for invalid numbers', () => {
  assert.deepEqual(
    normalizeTopperWeights({ assessment: 'bad' as unknown as number, project: 40, minAttendance: 80, threshold: 85 }),
    { assessment: 70, project: 40, minAttendance: 80, threshold: 85 },
  )
  assert.equal(isTopper(84, { threshold: 85 }), false)
  assert.equal(isTopper(85, { threshold: 85 }), true)
})

test('proctoring risk excludes auto-submit marker and maps score bands', () => {
  const events = [
    event('phone_detected'),
    event('multiple_faces'),
    event('auto-submit'),
  ]

  assert.deepEqual(calculateProctoringRisk(events), { score: 80, level: 'high' })
  assert.equal(getProctoringRiskLevel(30), 'low')
  assert.equal(getProctoringRiskLevel(31), 'medium')
  assert.equal(getProctoringRiskLevel(61), 'high')
  assert.equal(getProctoringRiskLevel(101), 'critical')
})

test('proctoring auto-submit triggers on violation count, critical risk, or repeated severe signals', () => {
  assert.equal(shouldAutoSubmitForIntegrity([event('tab-hidden'), event('window-blur')], 3), true)
  assert.equal(shouldAutoSubmitForIntegrity([event('face_substitution')], 1), true)
  assert.equal(shouldAutoSubmitForIntegrity([
    event('multiple_faces'),
    event('multiple_faces'),
    event('multiple_faces'),
    event('multiple_faces'),
  ], 1), true)
  assert.equal(shouldAutoSubmitForIntegrity([event('tab-hidden')], 1), false)
})

test('proctoring validation summary reports precision and recall', () => {
  assert.deepEqual(
    summarizeProctoringValidation([
      { expectedViolation: true, observedViolation: true },
      { expectedViolation: true, observedViolation: false },
      { expectedViolation: false, observedViolation: true },
      { expectedViolation: false, observedViolation: false },
    ]),
    {
      totalRuns: 4,
      falsePositives: 1,
      falseNegatives: 1,
      precision: 50,
      recall: 50,
    },
  )
})

function event(type: ProctoringEvent['type']): ProctoringEvent {
  return {
    type,
    label: type,
    occurredAt: new Date().toISOString(),
    riskLevel: 'medium',
  }
}
