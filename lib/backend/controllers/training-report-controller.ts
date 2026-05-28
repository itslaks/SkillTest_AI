import { fetchTrainingOpsDataset, fetchTrainingOpsPdfSummary } from '@/lib/backend/repositories/training-report-repository'
import { buildTrainingOpsEvidenceWorkbook, buildTrainingOpsPdf } from '@/lib/backend/services/training-report-service'
import { requireManagerForApi } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export async function downloadTrainingOpsEvidencePack() {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  const result = await fetchTrainingOpsDataset(auth.userId)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error || 'Unable to build training operations evidence pack.' }, { status: 500 })
  }

  const buffer = buildTrainingOpsEvidenceWorkbook(result.data)
  const filename = `skilltest-ai-mavericks-evidence-pack-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function downloadTrainingOpsPdfReport() {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  const summary = await fetchTrainingOpsPdfSummary(auth.userId)
  const pdf = buildTrainingOpsPdf(summary)

  return new NextResponse(Buffer.from(pdf, 'binary'), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="skilltest-ai-mavericks-training-ops-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  })
}
