export type UserRole = 'employee' | 'manager' | 'admin'

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'advanced' | 'hardcore'

export type AttemptStatus = 'in_progress' | 'completed' | 'abandoned'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
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
  correct_option_index: number
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

export type TrainingBatchStatus = 'planned' | 'active' | 'at_risk' | 'completed'
export type BatchMemberStatus = 'invited' | 'active' | 'completed' | 'dropped'
export type BatchSupportStatus = 'on_track' | 'needs_support' | 'critical'
export type SessionMode = 'virtual' | 'classroom' | 'hybrid'
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type NotificationAudience = 'batch' | 'trainers' | 'coordinators' | 'individual'
export type NotificationChannel = 'in_app' | 'email' | 'whatsapp'
export type NotificationDeliveryStatus = 'draft' | 'scheduled' | 'sent'
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
  created_at: string
}

export interface TrainingOpsSummary {
  totalBatches: number
  activeBatches: number
  upcomingSessions: number
  attendanceRate: number
  notificationsSent: number
  negativeFeedbackCount: number
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
  answers: QuizAnswer[]
  time_taken_seconds: number
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
