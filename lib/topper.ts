export type TopperWeights = {
  assessment: number
  project: number
  minAttendance: number
  threshold?: number
}

export type TopperScoreInput = {
  assessmentAvg: number
  projectScore: number
  attendancePct: number
  weights: TopperWeights
}

export const DEFAULT_TOPPER_WEIGHTS: Required<TopperWeights> = {
  assessment: 70,
  project: 30,
  minAttendance: 75,
  threshold: 80,
}

export function normalizeTopperWeights(weights?: Partial<TopperWeights>): Required<TopperWeights> {
  return {
    assessment: safeNumber(weights?.assessment, DEFAULT_TOPPER_WEIGHTS.assessment),
    project: safeNumber(weights?.project, DEFAULT_TOPPER_WEIGHTS.project),
    minAttendance: safeNumber(weights?.minAttendance, DEFAULT_TOPPER_WEIGHTS.minAttendance),
    threshold: safeNumber(weights?.threshold, DEFAULT_TOPPER_WEIGHTS.threshold),
  }
}

export function computeTopperScore({ assessmentAvg, projectScore, attendancePct, weights }: TopperScoreInput) {
  const normalized = normalizeTopperWeights(weights)
  if (attendancePct < normalized.minAttendance) return 0
  const totalWeight = normalized.assessment + normalized.project
  if (totalWeight <= 0) return 0
  return Math.round(((assessmentAvg * normalized.assessment) + (projectScore * normalized.project)) / totalWeight)
}

export function isTopper(score: number, weights?: Partial<TopperWeights>) {
  return score >= normalizeTopperWeights(weights).threshold
}

export function averageScore(values: Array<number | null | undefined>) {
  const clean = values
    .filter((value) => value !== null && value !== undefined)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
  return clean.length ? Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length) : 0
}

function safeNumber(value: unknown, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}
