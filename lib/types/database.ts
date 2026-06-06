export type UserRole = 'employee' | 'trainer' | 'training_coordinator' | 'manager' | 'admin'

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'advanced' | 'hardcore'

export type AttemptStatus = 'in_progress' | 'completed' | 'abandoned'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  approval_status: 'pending' | 'approved' | 'rejected'
  rejection_reason: string | null
  department: string | null
  domain: string | null
  employee_id: string | null
  manager_id: string | null
  created_at: string
  updated_at: string
}

export interface Quiz {
  id: string
  title: string
  description: string | null
  topic: string
  batch_id: string | null
  difficulty: DifficultyLevel
  time_limit_minutes: number
  question_count: number
  passing_score: number
  feedback_form_url: string | null
  proctoring_required?: boolean
  is_active: boolean
  status: 'draft' | 'active' | 'archived'
  starts_at: string | null
  ends_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  quiz_id: string
  question_text: string
  options: { text: string; isCorrect: boolean }[]
  correct_option_index?: number
  difficulty: DifficultyLevel
  explanation: string | null
  is_ai_generated: boolean
  order_index: number | null
  created_at: string
  updated_at: string
}

export interface QuizAttempt {
  id: string
  quiz_id: string
  user_id: string
  answers: QuizAnswer[] | null
  score: number
  total_questions: number
  correct_answers: number
  time_taken_seconds: number
  points_earned: number
  status: AttemptStatus
  proctoring_status?: 'clear' | 'flagged' | null
  proctoring_violations_count?: number | null
  proctoring_risk_score?: number | null
  proctoring_risk_level?: ProctoringRiskLevel | null
  proctoring_events?: ProctoringEvent[] | null
  integrity_report?: Record<string, unknown> | null
  auto_submitted?: boolean | null
  review_status?: 'pending' | 'under_review' | 'approved' | 'rejected' | 'retest_required' | 'escalated'
  reviewed_by?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
  review_decision?: string | null
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface Badge {
  id: string
  name: string
  description: string | null
  icon: string | null
  criteria: Record<string, unknown> | null
  points: number
  category?: string | null
  color?: string | null
  shape?: string | null
  rarity?: string | null
  created_at: string
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
}

export interface UserStats {
  id: string
  user_id: string
  total_points: number
  current_streak: number
  longest_streak: number
  tests_completed: number
  average_score: number
  last_activity_date: string | null
  updated_at: string
}

export interface QuizAssignment {
  id: string
  quiz_id: string
  user_id: string
  assigned_by: string
  assigned_at: string
  due_date: string | null
}

export type TrainingBatchStatus = 'planned' | 'running' | 'completed' | 'closed' | 'active' | 'at_risk'
export type BatchMemberStatus = 'invited' | 'active' | 'completed' | 'dropped' | 'discontinued' | 'not_cleared' | 'offered' | 'onboarded'
export type BatchSupportStatus = 'on_track' | 'needs_support' | 'critical'
export type SessionMode = 'virtual' | 'classroom' | 'hybrid'
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type NotificationAudience = 'batch' | 'trainers' | 'coordinators' | 'individual'
export type NotificationChannel = 'in_app' | 'email' | 'whatsapp'
export type NotificationDeliveryStatus = 'draft' | 'scheduled' | 'queued' | 'sent' | 'failed' | 'logged'
export type FeedbackSentiment = 'positive' | 'neutral' | 'negative'

export interface TrainingBatch {
  id: string
  title: string
  description: string | null
  domain: string | null
  status: TrainingBatchStatus
  start_date: string | null
  end_date: string | null
  trainer_id: string | null
  coordinator_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface TrainingBatchTrainer {
  id: string
  batch_id: string
  trainer_id: string
  role_label: string
  assigned_by: string | null
  assigned_at: string
}

export interface BatchMember {
  id: string
  batch_id: string
  user_id: string
  enrollment_status: BatchMemberStatus
  support_status: BatchSupportStatus
  joined_at: string
  completed_at: string | null
}

export interface TrainingSession {
  id: string
  batch_id: string
  trainer_id: string | null
  title: string
  agenda: string | null
  session_date: string
  mode: SessionMode
  status: SessionStatus
  attendance_required: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface SessionAttendance {
  id: string
  session_id: string
  user_id: string
  status: AttendanceStatus
  check_in_time: string | null
  notes: string | null
  updated_by: string | null
  updated_at: string
}

export interface SessionAttendanceVersion {
  id: string
  attendance_id: string | null
  session_id: string
  user_id: string
  previous_status: AttendanceStatus | null
  new_status: AttendanceStatus
  previous_notes: string | null
  new_notes: string | null
  changed_by: string | null
  changed_at: string
  source: 'manual' | 'excel' | 'automation'
}

export interface TrainingNotification {
  id: string
  batch_id: string | null
  session_id: string | null
  recipient_user_id: string | null
  title: string
  message: string
  audience: NotificationAudience
  channel: NotificationChannel
  delivery_status: NotificationDeliveryStatus
  scheduled_for: string | null
  sent_at: string | null
  created_by: string
  created_at: string
}

export interface TrainingFeedback {
  id: string
  batch_id: string | null
  session_id: string | null
  user_id: string
  submitted_by: string
  rating: number
  sentiment: FeedbackSentiment
  feedback_text: string
  action_item: string | null
  content_quality_rating: number | null
  trainer_effectiveness_rating: number | null
  created_at: string
}

export type TrainingAssessmentType = 'sprint_review' | 'api_coding' | 'coding' | 'project' | 'other'
export type TrainingAssessmentSetupStatus = 'planned' | 'open' | 'completed' | 'cancelled'

export interface TrainingAssessmentSetup {
  id: string
  batch_id: string
  title: string
  assessment_type: TrainingAssessmentType
  scheduled_at: string | null
  template_name: string | null
  question_file_name: string | null
  max_score: number
  passing_score: number
  status: TrainingAssessmentSetupStatus
  created_by: string
  created_at: string
  updated_at: string
}

export interface TrainingProjectEvaluation {
  id: string
  batch_id: string
  user_id: string
  evaluator_id: string | null
  project_title: string
  score: number
  evidence_file_name: string | null
  remarks: string | null
  created_at: string
  updated_at: string
}

export interface TrainingOpsSummary {
  totalBatches: number
  activeBatches: number
  atRiskBatches: number
  totalCandidates: number
  discontinuedCandidates: number
  notClearedCandidates: number
  offeredCandidates: number
  onboardedCandidates: number
  remainingCandidates: number
  upcomingSessions: number
  attendanceRate: number
  attendanceDueToday: number
  absenceAlerts: number
  notificationsSent: number
  negativeFeedbackCount: number
  assessmentSetups: number
  projectEvaluations: number
  automationRuns: number
}

// Extended types with relations
export interface QuizWithQuestions extends Quiz {
  questions: Question[]
}

export interface QuizAttemptWithQuiz extends QuizAttempt {
  quiz: Quiz
}

export interface UserBadgeWithDetails extends UserBadge {
  badge: Badge
}

export interface LeaderboardEntry {
  user_id: string
  full_name: string
  email: string
  employee_id: string | null
  avatar_url: string | null
  department: string | null
  score: number
  correct_answers: number
  total_questions: number
  time_taken_seconds: number
  points_earned: number
  completed_at: string
  rank: number
}

// Employee Import type
export interface EmployeeImport {
  email: string
  full_name: string
  domain?: string
  department?: string
  employee_id?: string
  role?: UserRole
}

export interface EmployeeImportError {
  row: number
  email: string
  error: string
}

export interface EmployeeImportResult {
  total: number
  successful: number
  failed: number
  errors: EmployeeImportError[]
}

export interface EmployeeImportRecord {
  id: string
  uploaded_by: string
  file_name: string
  total_records: number
  successful_imports: number
  failed_imports: number
  status: 'processing' | 'completed' | 'failed'
  error_log: EmployeeImportError[] | null
  created_at: string
}

// Assessment Import types
export interface AssessmentImport {
  id: string
  quiz_id: string | null
  uploaded_by: string
  file_name: string
  total_records: number
  status: 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface AssessmentResult {
  id: string
  import_id: string
  quiz_id: string | null
  batch_id?: string | null
  assessment_setup_id?: string | null
  uploaded_by?: string | null
  upload_fingerprint?: string | null
  candidate_id: string | null
  candidate_name: string
  candidate_email: string
  test_id: string | null
  test_name: string | null
  test_status: string | null
  test_score: number
  candidate_score: number
  negative_points: number
  percentage: number
  performance_category: string | null
  percentile: number
  total_questions: number
  answered: number
  not_answered: number
  correct: number
  wrong: number
  test_duration_minutes: number
  time_taken_minutes: number
  proctoring_flag: string | null
  window_violation: number
  time_violation_seconds: number
  candidate_feedback: string | null
  created_at: string
}

export interface AIChatSession {
  id: string
  user_id: string
  quiz_id: string | null
  title: string
  created_at: string
  updated_at: string
}

export interface AIChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface CreateQuizInput {
  title: string
  description?: string
  topic: string
  difficulty: DifficultyLevel
  time_limit_minutes: number
  question_count: number
  passing_score?: number
  feedback_form_url?: string
  proctoring_required?: boolean
  starts_at?: string | null
  ends_at?: string | null
}

export interface CreateQuestionInput {
  quiz_id: string
  question_text: string
  options: { text: string; isCorrect: boolean }[]
  difficulty: DifficultyLevel
  explanation?: string
  is_ai_generated?: boolean
  order_index?: number
}

export interface ParsedQuestion {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: string
  difficulty?: DifficultyLevel
  explanation?: string
}

export interface SubmitQuizInput {
  quiz_id: string
  answers: SubmittedQuizAnswer[]
  time_taken_seconds: number
  proctoring?: ProctoringSubmission
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface QuizAnswer {
  questionId: string
  selectedOption: number
  isCorrect: boolean
  timeSpent: number
  questionDifficulty?: DifficultyLevel
  cognitiveLoadFlag?: boolean
  panicSignal?: boolean
  adaptiveDifficulty?: DifficultyLevel
}

export interface SubmittedQuizAnswer {
  questionId: string
  selectedOption: number
  timeSpent: number
  questionDifficulty?: DifficultyLevel
  cognitiveLoadFlag?: boolean
  panicSignal?: boolean
  adaptiveDifficulty?: DifficultyLevel
}

export type ProctoringEventType =
  | 'camera-denied'
  | 'microphone-denied'
  | 'fullscreen-exit'
  | 'tab-hidden'
  | 'window-blur'
  | 'blocked-shortcut'
  | 'back-navigation'
  | 'context-menu'
  | 'copy-attempt'
  | 'paste-attempt'
  | 'devtools-open'
  | 'camera-lost'
  | 'network-offline'
  | 'no-face'
  | 'multiple-faces'
  | 'face-covered'
  | 'gaze-away'
  | 'phone-detected'
  | 'second-screen'
  | 'notes-detected'
  | 'audio-anomaly'
  | 'voice-assistance'
  | 'auto-submit'

export type ProctoringRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface ProctoringEvent {
  type: ProctoringEventType
  label: string
  occurredAt: string
  questionIndex?: number
  riskScore?: number
  riskLevel?: ProctoringRiskLevel
  evidenceImage?: string | null
  evidencePath?: string | null
}

export interface ProctoringSubmission {
  enabled: boolean
  sessionId?: string
  violationCount: number
  riskScore: number
  riskLevel: ProctoringRiskLevel
  autoSubmitted: boolean
  events: ProctoringEvent[]
}

export type ProctoringReviewStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'retest_required' | 'escalated'

export interface ReadinessInsight {
  score: number
  predictedScore: number
  status: 'ready' | 'revise' | 'focus'
  recommendation: string
  streakBoost: number
  historyBoost: number
  topicAlignmentBoost: number
  trainingDaysBoost: number
}

export interface AttemptInsight {
  averageAnswerTime: number
  easyQuestionOverloadCount: number
  fastGuessCount: number
  slowStruggleCount: number
  timeVariance: number
  focusScore: number
  confidenceScore: number
  riskLevel: 'low' | 'medium' | 'high'
  behaviorTags: string[]
  cognitiveLoadDetected: boolean
  panicModeDetected: boolean
  panicStreak: number
  suggestedNextDifficulty: DifficultyLevel
  antiGamingDetected: boolean
  masterySignal: string
}

export interface TopicStrengthPoint {
  topic: string
  score: number
  accuracy: number
  overloadRate: number
}

export interface TrainerImpactPoint {
  trainerId: string
  trainerName: string
  topic: string
  impactScore: number
  averageScore: number
  attempts: number
}

export interface RetentionCheck {
  topic: string
  daysSinceLastAssessment: number
  baselineScore: number
  latestScore: number
  decayDelta: number
  status: 'healthy' | 'watch' | 'critical'
}
