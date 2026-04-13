export type UserRole = 'employee' | 'manager' | 'admin'

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'advanced' | 'hardcore'

export type QuestionStatus = 'pending' | 'approved' | 'rejected'

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
  difficulty: DifficultyLevel
  time_limit_minutes: number
  question_count: number
  passing_score: number
  feedback_form_url: string | null
  is_active: boolean
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
  status: QuestionStatus
  is_ai_generated: boolean
  is_approved: boolean
  order_index: number | null
  created_at: string
  updated_at: string
}

export interface QuizAttempt {
  id: string
  quiz_id: string
  user_id: string
  answers: { questionId: string; selectedOption: number; isCorrect: boolean; timeSpent: number }[] | null
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
  criteria: Record<string, any> | null
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

export interface EmployeeImportRecord {
  id: string
  uploaded_by: string
  file_name: string
  total_records: number
  successful_imports: number
  failed_imports: number
  status: 'processing' | 'completed' | 'failed'
  error_log: any[] | null
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
}

export interface CreateQuestionInput {
  quiz_id: string
  question_text: string
  options: { text: string; isCorrect: boolean }[]
  difficulty: DifficultyLevel
  explanation?: string
  is_ai_generated?: boolean
  is_approved?: boolean
  order_index?: number
  status?: QuestionStatus
}

export interface SubmitQuizInput {
  quiz_id: string
  answers: { questionId: string; selectedOption: number; isCorrect: boolean; timeSpent: number }[]
  time_taken_seconds: number
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
}
