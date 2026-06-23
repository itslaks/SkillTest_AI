export type ProfileRef = {
  id?: string | null
  full_name?: string | null
  email?: string | null
  employee_id?: string | null
  avatar_url?: string | null
  domain?: string | null
  department?: string | null
}

export type Relation<T> = T | T[] | null | undefined

export function firstRelation<T>(relation: Relation<T>): T | null {
  if (Array.isArray(relation)) return relation[0] || null
  return relation || null
}

export type ManagerBatchRef = {
  id: string
  title: string
  status?: string | null
  organization_id?: string | null
}

export type ManagerTrainingSessionRef = {
  id: string
  batch_id?: string | null
  title?: string | null
  status?: string | null
  session_date?: string | null
}

export type ManagerAttendanceRow = {
  session_id?: string | null
  user_id?: string | null
  status?: string | null
  session?: ManagerTrainingSessionRef | null
}

export type ManagerAssessmentResultRow = {
  batch_id?: string | null
  assessment_setup_id?: string | null
  candidate_email?: string | null
  percentage?: number | null
  candidate_score?: number | null
}

export type ManagerFeedbackRow = {
  batch_id?: string | null
  rating?: number | null
  trainer_effectiveness_rating?: number | null
  sentiment?: string | null
}
