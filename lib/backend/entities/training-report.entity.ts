export type TrainingProfileRef = {
  id?: string | null
  full_name?: string | null
  email?: string | null
  employee_id?: string | null
  department?: string | null
  domain?: string | null
}

export type TrainingBatchRow = {
  id: string
  title: string
  domain?: string | null
  status: string
  start_date?: string | null
  end_date?: string | null
  trainer?: TrainingProfileRef | TrainingProfileRef[] | null
  coordinator?: TrainingProfileRef | TrainingProfileRef[] | null
  batch_members?: { count: number }[] | null
  training_sessions?: { count: number }[] | null
}

export type BatchMemberRow = {
  batch_id: string
  user_id?: string | null
  enrollment_status?: string | null
  support_status?: string | null
  joined_at?: string | null
  profile?: TrainingProfileRef | null
}

export type TrainingSessionRow = {
  id: string
  batch_id: string
  title?: string | null
  session_date?: string | null
}

export type SessionAttendanceRow = {
  session_id?: string | null
  user_id?: string | null
  status?: string | null
  check_in_time?: string | null
  notes?: string | null
  updated_at?: string | null
  session?: TrainingSessionRow | null
  profile?: TrainingProfileRef | null
}

export type TrainingAttendanceUploadRow = {
  session_id?: string | null
  file_name?: string | null
  total_records?: number | null
  successful_records?: number | null
  failed_records?: number | null
  uploaded_after_cutoff?: boolean | null
  late_reason?: string | null
  created_at?: string | null
  session?: Pick<TrainingSessionRow, 'title'> | null
  uploader?: TrainingProfileRef | null
}

export type TrainingQuizRow = {
  id?: string
  batch_id?: string | null
  title: string
  topic?: string | null
  difficulty?: string | null
  passing_score?: number | null
  is_active?: boolean | null
}

export type TrainingAssessmentSetupRow = {
  id?: string
  batch_id?: string | null
  title?: string | null
  assessment_type?: string | null
  scheduled_at?: string | null
  template_name?: string | null
  question_file_name?: string | null
  max_score?: number | null
  passing_score?: number | null
  status?: string | null
}

export type TrainingProjectEvaluationRow = {
  batch_id?: string | null
  user_id?: string | null
  project_title?: string | null
  score?: number | null
  evidence_file_name?: string | null
  remarks?: string | null
  profile?: TrainingProfileRef | null
  evaluator?: TrainingProfileRef | null
}

export type TrainingFeedbackRow = {
  batch_id?: string | null
  rating?: number | null
  trainer_effectiveness_rating?: number | null
  sentiment?: string | null
  feedback_text?: string | null
  action_item?: string | null
  created_at?: string | null
  batch?: Pick<TrainingBatchRow, 'title'> | null
  session?: Pick<TrainingSessionRow, 'title'> | null
  trainee?: TrainingProfileRef | null
}

export type TrainingNotificationRow = {
  id: string
  title?: string | null
  audience?: string | null
  channel?: string | null
  delivery_status?: string | null
  scheduled_for?: string | null
  sent_at?: string | null
  message?: string | null
  batch?: Pick<TrainingBatchRow, 'title'> | null
  session?: Pick<TrainingSessionRow, 'title'> | null
  recipient?: TrainingProfileRef | null
}

export type TrainingNotificationDispatchLogRow = {
  notification_id?: string | null
  channel?: string | null
  recipient_email?: string | null
  provider_status?: string | null
  provider_message?: string | null
  created_at?: string | null
}

export type TrainingAutomationRunRow = {
  run_type?: string | null
  batch_id?: string | null
  session_id?: string | null
  status?: string | null
  notifications_created?: number | null
  notes?: string | null
  created_at?: string | null
}

export type TrainingAttemptRow = {
  user_id?: string | null
  score?: number | null
  points_earned?: number | null
  time_taken_seconds?: number | null
  quizzes?: { batch_id?: string | null } | null
  profiles?: TrainingProfileRef | null
}

export type TrainingOpsSettings = Record<string, string | number | boolean | null>

export type TrainingOpsDataset = {
  batches: TrainingBatchRow[]
  members: BatchMemberRow[]
  sessions: TrainingSessionRow[]
  attendance: SessionAttendanceRow[]
  uploads: TrainingAttendanceUploadRow[]
  notifications: TrainingNotificationRow[]
  notificationDispatchLogs: TrainingNotificationDispatchLogRow[]
  feedback: TrainingFeedbackRow[]
  quizzes: TrainingQuizRow[]
  settings: TrainingOpsSettings
  attempts: TrainingAttemptRow[]
  projectEvaluations: TrainingProjectEvaluationRow[]
  assessmentSetups: TrainingAssessmentSetupRow[]
  automationRuns: TrainingAutomationRunRow[]
}

export type TrainingOpsPdfSummary = {
  batches: TrainingBatchRow[]
  feedback: Pick<TrainingFeedbackRow, 'batch_id'>[]
  projectEvaluations: Pick<TrainingProjectEvaluationRow, 'batch_id'>[]
  automationRuns: Pick<TrainingAutomationRunRow, 'batch_id' | 'notifications_created'>[]
  notifications: Pick<TrainingNotificationRow, 'id' | 'batch'>[]
  dispatchLogs: Pick<TrainingNotificationDispatchLogRow, 'provider_status'>[]
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
