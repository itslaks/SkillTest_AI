import type { ProctoringEvent, ProctoringEventType, ProctoringRiskLevel } from '@/lib/types/database'

export type ProctoringEventPostPayload = {
  sessionId: string
  attemptId: string
  type: ProctoringEventType
  label: string
  questionIndex?: number
  evidenceImage?: string | null
}

export const PROCTORING_VIOLATION_LIMIT = 3
export const PROCTORING_CRITICAL_RISK_SCORE = 100

export const PROCTORING_RISK_WEIGHTS: Record<ProctoringEventType, number> = {
  'camera-denied': 30,
  'microphone-denied': 20,
  'fullscreen-exit': 10,
  'fullscreen_exit': 20,
  'tab-hidden': 10,
  'tab_switch': 18,
  'focus_loss': 15,
  'window-blur': 10,
  'window_switch': 15,
  'blocked-shortcut': 8,
  'back-navigation': 10,
  'context-menu': 6,
  'right_click': 8,
  'copy-attempt': 8,
  'copy_detected': 25,
  'paste-attempt': 8,
  'paste_detected': 20,
  'devtools-open': 20,
  'dev_tools': 30,
  'screenshot_attempt': 22,
  'camera-lost': 25,
  'network-offline': 20,
  'no-face': 15,
  'no_face': 25,
  'multiple-faces': 35,
  'multiple_faces': 35,
  'face-covered': 20,
  'gaze-away': 15,
  'gaze_away': 20,
  'gaze_down': 20,
  'phone-detected': 45,
  'phone_detected': 45,
  'electronic_device': 40,
  'book_detected': 30,
  'second-screen': 30,
  'notes-detected': 20,
  'audio-anomaly': 30,
  'voice-assistance': 40,
  'face_substitution': 45,  // highest-severity: possible impersonation
  'auto-submit': 0,
}

export const VIOLATION_SEVERITY: Record<ProctoringEventType, ProctoringRiskLevel> = {
  'camera-denied': 'high',
  'microphone-denied': 'medium',
  'fullscreen-exit': 'medium',
  'fullscreen_exit': 'high',
  'tab-hidden': 'medium',
  'tab_switch': 'high',
  'focus_loss': 'high',
  'window-blur': 'medium',
  'window_switch': 'high',
  'blocked-shortcut': 'medium',
  'back-navigation': 'medium',
  'context-menu': 'medium',
  'right_click': 'medium',
  'copy-attempt': 'medium',
  'copy_detected': 'critical',
  'paste-attempt': 'medium',
  'paste_detected': 'high',
  'devtools-open': 'high',
  'dev_tools': 'critical',
  'screenshot_attempt': 'critical',
  'camera-lost': 'high',
  'network-offline': 'high',
  'no-face': 'high',
  'no_face': 'high',
  'multiple-faces': 'high',
  'multiple_faces': 'high',
  'face-covered': 'high',
  'gaze-away': 'high',
  'gaze_away': 'high',
  'gaze_down': 'high',
  'phone-detected': 'critical',
  'phone_detected': 'critical',
  'electronic_device': 'critical',
  'book_detected': 'high',
  'second-screen': 'critical',
  'notes-detected': 'high',
  'audio-anomaly': 'high',
  'voice-assistance': 'critical',
  'face_substitution': 'critical',
  'auto-submit': 'critical',
}

export const VIOLATION_COLOR: Record<ProctoringRiskLevel, string> = {
  critical: 'red',
  high: 'rose',
  medium: 'amber',
  low: 'emerald',
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
    || typeCount('multiple_faces') > 3
    || typeCount('phone-detected') > 3
    || typeCount('face-covered') > 3
    || typeCount('no_face') > 3
  )
}
