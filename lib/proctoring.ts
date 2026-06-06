import type { ProctoringEvent, ProctoringEventType, ProctoringRiskLevel } from '@/lib/types/database'

export const PROCTORING_VIOLATION_LIMIT = 3
export const PROCTORING_CRITICAL_RISK_SCORE = 100

export const PROCTORING_RISK_WEIGHTS: Record<ProctoringEventType, number> = {
  'camera-denied': 30,
  'microphone-denied': 20,
  'fullscreen-exit': 10,
  'tab-hidden': 10,
  'window-blur': 10,
  'blocked-shortcut': 8,
  'back-navigation': 10,
  'context-menu': 6,
  'copy-attempt': 8,
  'paste-attempt': 8,
  'devtools-open': 20,
  'camera-lost': 25,
  'network-offline': 20,
  'no-face': 15,
  'multiple-faces': 25,
  'face-covered': 20,
  'gaze-away': 15,
  'phone-detected': 30,
  'second-screen': 30,
  'notes-detected': 20,
  'audio-anomaly': 30,
  'voice-assistance': 40,
  'auto-submit': 0,
}

export function getProctoringRiskLevel(score: number): ProctoringRiskLevel {
  if (score > PROCTORING_CRITICAL_RISK_SCORE) return 'critical'
  if (score >= 61) return 'high'
  if (score >= 31) return 'medium'
  return 'low'
}

export function getProctoringEventRisk(type: ProctoringEventType) {
  return PROCTORING_RISK_WEIGHTS[type] ?? 10
}

export function calculateProctoringRisk(events: ProctoringEvent[]) {
  const score = events.reduce((total, event) => {
    if (event.type === 'auto-submit') return total
    return total + getProctoringEventRisk(event.type)
  }, 0)

  return {
    score,
    level: getProctoringRiskLevel(score),
  }
}

export function shouldAutoSubmitForIntegrity(events: ProctoringEvent[], violationCount: number) {
  const risk = calculateProctoringRisk(events)
  const typeCount = (type: ProctoringEventType) => events.filter((event) => event.type === type).length

  return (
    violationCount >= PROCTORING_VIOLATION_LIMIT
    || risk.score > PROCTORING_CRITICAL_RISK_SCORE
    || typeCount('multiple-faces') > 3
    || typeCount('phone-detected') > 3
  )
}
