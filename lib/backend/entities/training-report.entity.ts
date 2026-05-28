export type TrainingOpsDataset = {
  batches: any[]
  members: any[]
  sessions: any[]
  attendance: any[]
  uploads: any[]
  notifications: any[]
  notificationDispatchLogs: any[]
  feedback: any[]
  quizzes: any[]
  settings: Record<string, any>
  attempts: any[]
  projectEvaluations: any[]
  assessmentSetups: any[]
  automationRuns: any[]
}

export type TrainingOpsPdfSummary = {
  batches: any[]
  feedback: any[]
  projectEvaluations: any[]
  automationRuns: any[]
  notifications: any[]
  dispatchLogs: any[]
}

export type BrdCoverageDataset = Pick<
  TrainingOpsDataset,
  | 'batches'
  | 'members'
  | 'sessions'
  | 'attendance'
  | 'uploads'
  | 'assessmentSetups'
  | 'projectEvaluations'
  | 'feedback'
  | 'notifications'
  | 'notificationDispatchLogs'
  | 'automationRuns'
>
