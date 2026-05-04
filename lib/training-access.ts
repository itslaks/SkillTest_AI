import { createAdminClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types/database'

export async function canAccessTrainingBatch(batchId: string, userId: string, role: UserRole) {
  const admin = createAdminClient()
  const { data: batch } = await admin
    .from('training_batches')
    .select('id, created_by, coordinator_id, trainer_id')
    .eq('id', batchId)
    .maybeSingle()

  if (!batch) return false
  if (role === 'admin') return true
  if (batch.created_by === userId || batch.coordinator_id === userId || batch.trainer_id === userId) return true

  const { data: assignment } = await admin
    .from('training_batch_trainers')
    .select('id')
    .eq('batch_id', batchId)
    .eq('trainer_id', userId)
    .maybeSingle()

  return Boolean(assignment)
}

export async function canTrainerAccessBatch(batchId: string, userId: string) {
  return canAccessTrainingBatch(batchId, userId, 'trainer')
}

export async function getAccessibleTrainingBatchIds(userId: string, role: UserRole) {
  const admin = createAdminClient()
  if (role === 'admin') {
    const { data } = await admin.from('training_batches').select('id')
    return (data || []).map((batch: any) => batch.id as string)
  }

  const { data: ownedBatches } = await admin
    .from('training_batches')
    .select('id')
    .or(`created_by.eq.${userId},coordinator_id.eq.${userId},trainer_id.eq.${userId}`)

  const { data: assignedBatches } = await admin
    .from('training_batch_trainers')
    .select('batch_id')
    .eq('trainer_id', userId)

  return Array.from(new Set([
    ...(ownedBatches || []).map((batch: any) => batch.id as string),
    ...(assignedBatches || []).map((assignment: any) => assignment.batch_id as string),
  ]))
}
