'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, FileSpreadsheet, Upload, XCircle, Download } from 'lucide-react'
import { EXCEL_WITH_OPTIONAL_TEXT_ACCEPT, parseUniversalRowsFile } from '@/lib/file-utils'

type BatchOption = { id: string; title: string }
type AssessmentOption = { id: string; batch_id: string; title: string; assessment_type: string }
const CHUNK_SIZE = 1000
type UploadProgress = { current: number; total: number; processed: number; totalRows: number; label: string } | null

export function AssessmentScoreImporter({
  batches,
  assessments,
}: {
  batches: BatchOption[]
  assessments: AssessmentOption[]
}) {
  const [batchId, setBatchId] = useState(batches[0]?.id || '')
  const [assessmentSetupId, setAssessmentSetupId] = useState('')
  const [rows, setRows] = useState<Record<string, any>[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [message, setMessage] = useState('')
  const [uploadErrors, setUploadErrors] = useState<Array<{ row?: number; batch?: number; error: string; email?: string }>>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress>(null)

  const visibleAssessments = assessments.filter((assessment) => !batchId || assessment.batch_id === batchId)

  async function readFile(file: File) {
    setError('')
    setMessage('')
    setUploadErrors([])
    setProgress(null)
    setFileName(file.name)
    try {
      const parsed = await parseUniversalRowsFile(file)
      if (!parsed.length) {
        setError('The assessment score file is empty.')
        return
      }
      setRows(parsed)
    } catch (err: any) {
      setError(err.message || 'Could not read this file. Use the Excel assessment template.')
    }
  }

  async function upload() {
    if (!batchId || !rows?.length) return
    setLoading(true)
    setError('')
    try {
      const duplicateKeys = findDuplicateAssessmentRows(rows, batchId, assessmentSetupId)
      if (duplicateKeys.size) {
        setError(`Duplicate assessment rows found before upload: ${Array.from(duplicateKeys).slice(0, 5).join(', ')}${duplicateKeys.size > 5 ? '...' : ''}`)
        return
      }
      let total = 0
      let inserted = 0
      const errors: Array<{ row?: number; batch?: number; error: string; email?: string }> = []
      const chunks = chunkRows(rows, CHUNK_SIZE)
      for (let index = 0; index < chunks.length; index++) {
        setProgress({
          current: index + 1,
          total: chunks.length,
          processed: Math.min(index * CHUNK_SIZE, rows.length),
          totalRows: rows.length,
          label: `Uploading score chunk ${index + 1} of ${chunks.length}`,
        })
        const response = await fetch('/api/assessment-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId,
            assessmentSetupId: assessmentSetupId || null,
            records: chunks[index],
            fileName,
            chunkIndex: index + 1,
            chunkTotal: chunks.length,
          }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Assessment upload failed.')
        total += payload.totalRecords || chunks[index].length
        inserted += payload.insertedRecords || 0
        errors.push(...((payload.errors || []).map((item: any) => ({ ...item, row: item.row ? item.row + (index * CHUNK_SIZE) : item.row }))))
        setProgress({
          current: index + 1,
          total: chunks.length,
          processed: Math.min((index + 1) * CHUNK_SIZE, rows.length),
          totalRows: rows.length,
          label: `Completed score chunk ${index + 1} of ${chunks.length}`,
        })
      }
      setMessage(`${inserted}/${total} assessment rows imported. ${errors.length} row(s) need review.`)
      setUploadErrors(errors)
      setRows(null)
    } catch (err: any) {
      setError(err.message || 'Assessment upload failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <FileSpreadsheet className="h-4 w-4" />
            Assessment score Excel upload
          </div>
          <p className="mt-1 text-sm text-zinc-500">Upload the XLSX assessment score template. CSV/TXT remain optional compatibility formats.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Batch</span>
          <select value={batchId} onChange={(event) => setBatchId(event.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-white px-3">
            {batches.length === 0 ? <option value="">Create a batch first</option> : batches.map((batch) => (
              <option key={batch.id} value={batch.id}>{batch.title}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Assessment setup</span>
          <select value={assessmentSetupId} onChange={(event) => setAssessmentSetupId(event.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-white px-3">
            <option value="">General score upload</option>
            {visibleAssessments.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>{assessment.title} - {assessment.assessment_type.replace('_', ' ')}</option>
            ))}
          </select>
        </label>
        <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100 lg:self-end">
          <Upload className="h-4 w-4" />
          Select Excel file
          <input type="file" accept={EXCEL_WITH_OPTIONAL_TEXT_ACCEPT} className="hidden" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} />
        </label>
      </div>

      {rows ? (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p><strong>{rows.length}</strong> score row(s) ready from {fileName}.</p>
            <Button onClick={upload} disabled={loading || !batchId} className="rounded-full bg-black text-white hover:bg-zinc-800">
              {loading ? 'Uploading...' : 'Upload scores'}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.keys(rows[0] || {}).slice(0, 8).map((column) => (
              <Badge key={column} variant="outline" className="bg-white">{column}</Badge>
            ))}
          </div>
          <UploadProgressPanel progress={progress} />
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />{message}</div>
            {uploadErrors.length ? (
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-full bg-white" onClick={() => downloadAssessmentIssues(uploadErrors, fileName || 'assessment-upload')}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download issues
              </Button>
            ) : null}
          </div>
          {uploadErrors.length ? (
            <div className="mt-3 overflow-x-auto rounded-xl border border-rose-200 bg-white text-xs text-rose-800">
              <div className="grid grid-cols-[5rem_1fr_1.6fr] gap-2 border-b border-rose-100 bg-rose-50 px-3 py-2 font-semibold">
                <span>Row</span>
                <span>Candidate</span>
                <span>Issue</span>
              </div>
              <div className="max-h-60 overflow-auto">
                {uploadErrors.slice(0, 25).map((item, index) => (
                  <div key={`${item.row || item.batch || index}-${item.error}`} className="grid grid-cols-[5rem_1fr_1.6fr] gap-2 border-b border-rose-50 px-3 py-2 last:border-0">
                    <span>{item.row ? `Row ${item.row}` : item.batch !== undefined ? `Batch ${item.batch}` : 'Upload'}</span>
                    <span className="truncate" title={item.email || ''}>{item.email || 'Not provided'}</span>
                    <span>{item.error}</span>
                  </div>
                ))}
              </div>
              {uploadErrors.length > 25 ? <p className="border-t border-rose-100 px-3 py-2">{uploadErrors.length - 25} more row issue(s) are available in the downloadable issue file and upload log.</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><XCircle className="h-4 w-4" />{error}</div> : null}
    </div>
  )
}

function UploadProgressPanel({ progress }: { progress: UploadProgress }) {
  if (!progress) return null
  const pct = progress.totalRows ? Math.round((progress.processed / progress.totalRows) * 100) : 0
  return (
    <div className="mt-4 rounded-xl border border-blue-100 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-blue-900">
        <span>{progress.label}</span>
        <span>{progress.processed}/{progress.totalRows} rows - {pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function chunkRows<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}

function findDuplicateAssessmentRows(rows: Record<string, any>[], batchId: string, assessmentSetupId: string) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const row of rows) {
    const email = String(row.Candidate_Email_Address || row.candidate_email || '').trim().toLowerCase()
    const candidateId = String(row.Candidate_ID || row.candidate_id || '').trim().toLowerCase()
    const testId = String(assessmentSetupId || row.Test_Id || row.test_id || 'assessment').trim().toLowerCase()
    const key = `${batchId}:${testId}:${email || candidateId}`
    if (!email && !candidateId) continue
    if (seen.has(key)) duplicates.add(email || candidateId)
    seen.add(key)
  }
  return duplicates
}

function downloadAssessmentIssues(errors: Array<{ row?: number; batch?: number; error: string; email?: string }>, sourceName: string) {
  const header = ['Row', 'Batch Chunk', 'Candidate Email', 'Issue']
  const body = errors.map((item) => [item.row || '', item.batch ?? '', item.email || '', item.error])
  const csv = [header, ...body]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${sourceName.replace(/\.[^.]+$/, '')}-assessment-issues.csv`
  link.click()
  URL.revokeObjectURL(url)
}
