'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Download } from 'lucide-react'
import { parseUniversalRowsFile, UNIVERSAL_UPLOAD_ACCEPT } from '@/lib/file-utils'

type SessionOption = {
  id: string
  title: string
  batchTitle: string
  sessionDate: string
}

type AttendanceImporterProps = {
  sessions: SessionOption[]
}

type UploadResult = {
  totalRecords: number
  successfulRecords: number
  failedRecords: number
  errors?: Array<{ row: number; error: string; email?: string; employeeId?: string }>
  warnings?: Array<{ area?: string; message: string }>
  uploadedAfterCutoff?: boolean
}

const CHUNK_SIZE = 1000
type UploadProgress = { current: number; total: number; processed: number; totalRows: number; label: string } | null

export function AttendanceImporter({ sessions }: AttendanceImporterProps) {
  const [sessionId, setSessionId] = useState(sessions[0]?.id || '')
  const [preview, setPreview] = useState<Record<string, any>[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [lateReason, setLateReason] = useState('')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress>(null)

  async function readFile(file: File) {
    setError('')
    setResult(null)
    setProgress(null)
    setFileName(file.name)
    try {
      const rows = await parseUniversalRowsFile(file)
      if (!rows.length) {
        setError('The attendance file is empty.')
        return
      }
      setPreview(rows)
    } catch (err: any) {
      setError(err.message || 'Could not read this file. Use the attendance template or a supported upload file.')
    }
  }

  async function upload() {
    if (!sessionId || !preview?.length) return
    setLoading(true)
    setError('')
    try {
      const duplicateKeys = findDuplicateKeys(preview)
      if (duplicateKeys.size) {
        setError(`Duplicate candidate rows found before upload: ${Array.from(duplicateKeys).slice(0, 5).join(', ')}${duplicateKeys.size > 5 ? '...' : ''}`)
        return
      }
      const aggregate: UploadResult = { totalRecords: preview.length, successfulRecords: 0, failedRecords: 0, errors: [] }
      const chunks = chunkRows(preview, CHUNK_SIZE)
      for (let index = 0; index < chunks.length; index++) {
        setProgress({
          current: index + 1,
          total: chunks.length,
          processed: Math.min(index * CHUNK_SIZE, preview.length),
          totalRows: preview.length,
          label: `Uploading chunk ${index + 1} of ${chunks.length}`,
        })
        const response = await fetch('/api/training/attendance-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, records: chunks[index], fileName, lateReason, chunkIndex: index + 1, chunkTotal: chunks.length }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Attendance upload failed.')
        aggregate.successfulRecords += payload.successfulRecords || 0
        aggregate.failedRecords += payload.failedRecords || 0
        aggregate.uploadedAfterCutoff = aggregate.uploadedAfterCutoff || Boolean(payload.uploadedAfterCutoff)
        aggregate.errors?.push(...((payload.errors || []).map((item: any) => ({ ...item, row: item.row + (index * CHUNK_SIZE) }))))
        aggregate.warnings = [
          ...(aggregate.warnings || []),
          ...((payload.warnings || []).map((item: any) => ({ area: item.area, message: item.message || String(item) }))),
        ]
        setProgress({
          current: index + 1,
          total: chunks.length,
          processed: Math.min((index + 1) * CHUNK_SIZE, preview.length),
          totalRows: preview.length,
          label: `Completed chunk ${index + 1} of ${chunks.length}`,
        })
      }
      setResult(aggregate)
      setPreview(null)
    } catch (err: any) {
      setError(err.message || 'Attendance upload failed.')
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
            Attendance upload
          </div>
          <p className="mt-1 text-sm text-zinc-500">Upload XLSX, CSV, or TXT with Email or Employee_ID and Status.</p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <a href="/api/training/attendance-template">Download template</a>
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Target session</span>
          <select value={sessionId} onChange={(event) => setSessionId(event.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-white px-3">
            {sessions.length === 0 ? (
              <option value="">Create a session first</option>
            ) : sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.batchTitle} - {session.title} - {new Date(session.sessionDate).toLocaleDateString()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100 lg:self-end">
          <Upload className="h-4 w-4" />
          Select file
          <input type="file" accept={UNIVERSAL_UPLOAD_ACCEPT} className="hidden" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} />
        </label>
      </div>

      {error ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <XCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      {preview ? (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p><strong>{preview.length}</strong> row(s) ready from {fileName}.</p>
              <Button onClick={upload} disabled={loading || !sessionId} className="rounded-full bg-black text-white hover:bg-zinc-800">
                {loading ? 'Uploading...' : 'Upload attendance'}
              </Button>
            </div>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Reason for late submission <span className="text-zinc-400 font-normal">(required if uploading after the cut-off time)</span></span>
              <textarea
                value={lateReason}
                onChange={(event) => setLateReason(event.target.value)}
                rows={2}
                className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-blue-950 placeholder:text-blue-300"
                placeholder="Example: System was unavailable earlier. Please explain why attendance is being submitted after the scheduled cut-off time."
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.keys(preview[0] || {}).slice(0, 6).map((column) => (
              <Badge key={column} variant="outline" className="bg-white">{column}</Badge>
            ))}
          </div>
          <UploadProgressPanel progress={progress} />
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Attendance upload complete
            </div>
            {result.errors?.length ? (
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-full bg-white" onClick={() => downloadIssues(result.errors || [], fileName || 'attendance-upload')}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download issues
              </Button>
            ) : null}
          </div>
          <p className="mt-1">{result.successfulRecords}/{result.totalRecords} rows updated. {result.failedRecords} row(s) need review.{result.uploadedAfterCutoff ? ' Late upload reason captured in the audit log.' : ''}</p>
          {result.warnings?.length ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-semibold">Attendance was marked, but these background logs need review:</p>
              {result.warnings.slice(0, 3).map((warning, index) => (
                <p key={`${warning.area || 'warning'}-${index}`} className="mt-1">{warning.message}</p>
              ))}
            </div>
          ) : null}
          {result.errors?.length ? (
            <div className="mt-3 overflow-x-auto rounded-xl border border-rose-200 bg-white text-xs text-rose-800">
              <div className="grid grid-cols-[4.5rem_1fr_1fr_1.4fr] gap-2 border-b border-rose-100 bg-rose-50 px-3 py-2 font-semibold">
                <span>Row</span>
                <span>Candidate</span>
                <span>Employee ID</span>
                <span>Issue</span>
              </div>
              <div className="max-h-60 overflow-auto">
                {result.errors.slice(0, 25).map((item) => (
                  <div key={`${item.row}-${item.error}`} className="grid grid-cols-[4.5rem_1fr_1fr_1.4fr] gap-2 border-b border-rose-50 px-3 py-2 last:border-0">
                    <span>{item.row}</span>
                    <span className="truncate" title={item.email || ''}>{item.email || 'Not provided'}</span>
                    <span className="truncate" title={item.employeeId || ''}>{item.employeeId || 'Not provided'}</span>
                    <span>{item.error}</span>
                  </div>
                ))}
              </div>
              {result.errors.length > 25 ? <p className="border-t border-rose-100 px-3 py-2">{result.errors.length - 25} more row issue(s) are available in the downloadable issue file and upload log.</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
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

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = []
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size))
  return chunks
}

function findDuplicateKeys(rows: Record<string, any>[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const row of rows) {
    const key = String(row.Email || row.email || row.Candidate_Email || row.Candidate_Email_Address || row.Employee_ID || row.employee_id || row.Candidate_ID || '').trim().toLowerCase()
    if (!key) continue
    if (seen.has(key)) duplicates.add(key)
    seen.add(key)
  }
  return duplicates
}

function downloadIssues(errors: NonNullable<UploadResult['errors']>, sourceName: string) {
  const header = ['Row', 'Candidate Email', 'Employee ID', 'Issue']
  const body = errors.map((item) => [item.row, item.email || '', item.employeeId || '', item.error])
  const csv = [header, ...body]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${sourceName.replace(/\.[^.]+$/, '')}-attendance-issues.csv`
  link.click()
  URL.revokeObjectURL(url)
}
