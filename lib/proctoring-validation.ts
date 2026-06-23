export type ProctoringValidationRunInput = {
  expectedViolation: boolean
  observedViolation: boolean
}

export type ProctoringValidationSummary = {
  totalRuns: number
  falsePositives: number
  falseNegatives: number
  precision: number
  recall: number
}

export function summarizeProctoringValidation(runs: ProctoringValidationRunInput[]): ProctoringValidationSummary {
  const falsePositives = runs.filter((run) => run.observedViolation && !run.expectedViolation).length
  const falseNegatives = runs.filter((run) => !run.observedViolation && run.expectedViolation).length
  const truePositives = runs.filter((run) => run.observedViolation && run.expectedViolation).length

  return {
    totalRuns: runs.length,
    falsePositives,
    falseNegatives,
    precision: ratio(truePositives, truePositives + falsePositives),
    recall: ratio(truePositives, truePositives + falseNegatives),
  }
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
}
