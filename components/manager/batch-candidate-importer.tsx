'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileSpreadsheet, Upload, CheckCircle2, XCircle, Download } from 'lucide-react'
import { parseUniversalRowsFile, UNIVERSAL_UPLOAD_ACCEPT } from '@/lib/file-utils'

type BatchOption = { id: string; title: string }
const CHUNK_SIZE = 1000
type UploadProgress = { current: number; total: number; processed: number; totalRows: number; label: string } | null

export function BatchCandidateImporter({ batches }: { batches: BatchOption[] }) {
  const [batchId, setBatchId] = useState(batches[0]?.id || '')
  const [rows, setRows] = useState<Record<string, any>[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [message, setMessage] = useState('')
  const [uploadErrors, setUploadErrors] = useState<Array<{ row?: number; error: string; email?: string; employeeId?: string }>>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress>(null)

  async function readFile(file: File) {
    setError('')
    setMessage('')
    setUploadErrors([])
    setProgress(null)
    setFileName(file.name)
    try {
      const parsed = await parseUniversalRowsFile(file)
      if (!parsed.length) {
        setError('The candidate assignment file is empty.')
        return
      }
      setRows(parsed)
    } catch (err: any) {
      setError(err.message || 'Could not read this file. Use a supported upload format.')
    }
  }

  async function upload() {
    if (!batchId || !rows?.length) return
    setLoading(true)
    setError('')
    try {
      const duplicateKeys = findDuplicateKeys(rows)
      if (duplicateKeys.size) {
        setError(`Duplicate candidate rows found before upload: ${Array.from(duplicateKeys).slice(0, 5).join(', ')}${duplicateKeys.size > 5 ? '...' : ''}`)
        return
      }
      let total = 0
      let successful = 0
      let failed = 0
      const errors: Array<{ row?: number; error: string; email?: string; employeeId?: string }> = []
      const chunks = chunkRows(rows, CHUNK_SIZE)
      for (let index = 0; index < chunks.length; index++) {
        setProgress({
          current: index + 1,
          total: chunks.length,
          processed: Math.min(index * CHUNK_SIZE, rows.length),
          totalRows: rows.length,
          label: `Assigning candidate chunk ${index + 1} of ${chunks.length}`,
        })
        const response = await fetch('/api/training/batch-candidate-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId, records: chunks[index], fileName, chunkIndex: index + 1, chunkTotal: chunks.length }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Candidate assignment failed.')
        total += payload.totalRecords || chunks[index].length
        successful += payload.successfulRecords || 0
        failed += payload.failedRecords || 0
        errors.push(...((payload.errors || []).map((item: any) => ({ ...item, row: item.row ? item.row + (index * CHUNK_SIZE) : item.row }))))
        setProgress({
          current: index + 1,
          total: chunks.length,
          processed: Math.min((index + 1) * CHUNK_SIZE, rows.length),
          totalRows: rows.length,
          label: `Completed candidate chunk ${index + 1} of ${chunks.length}`,
        })
      }
      setMessage(`${successful}/${total} candidate rows assigned. ${failed} row(s) need review.`)
      setUploadErrors(errors)
      setRows(null)
    } catch (err: any) {
      setError(err.message || 'Candidate assignment failed.')
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
            Batch candidate Excel upload
          </div>
          <p className="mt-1 text-sm text-zinc-500">Map candidate master Excel rows into a batch without manual selection.</p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <a href="/api/training/batch-candidate-template">Download template</a>
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Target batch</span>
          <select value={batchId} onChange={(event) => setBatchId(event.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-white px-3">
            {batches.length === 0 ? <option value="">Create a batch first</option> : batches.map((batch) => (
              <option key={batch.id} value={batch.id}>{batch.title}</option>
            ))}
          </select>
        </label>
        <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 text-sm font-medium hover:bg-zinc-100 lg:self-end">
          <Upload className="h-4 w-4" />
          Select Excel file
          <input type="file" accept={UNIVERSAL_UPLOAD_ACCEPT} className="hidden" onChange={(event) => event.target.files?.[0] && readFile(event.target.files[0])} />
        </label>
      </div>

      {rows ? (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p><strong>{rows.length}</strong> candidate row(s) ready from {fileName}.</p>
            <Button onClick={upload} disabled={loading || !batchId} className="rounded-full bg-black text-white hover:bg-zinc-800">
              {loading ? 'Assigning...' : 'Assign candidates'}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.keys(rows[0] || {}).slice(0, 6).map((column) => (
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
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-full bg-white" onClick={() => downloadCandidateIssues(uploadErrors, fileName || 'candidate-upload')}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download issues
              </Button>
            ) : null}
          </div>
          {uploadErrors.length ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-rose-200 bg-white text-xs text-rose-800">
              <div className="grid grid-cols-[4.5rem_1fr_1fr_1.4fr] gap-2 border-b border-rose-100 bg-rose-50 px-3 py-2 font-semibold">
                <span>Row</span>
                <span>Candidate</span>
                <span>Employee ID</span>
                <span>Issue</span>
              </div>
              <div className="max-h-60 overflow-auto">
                {uploadErrors.slice(0, 25).map((item, index) => (
                  <div key={`${item.row || index}-${item.error}`} className="grid grid-cols-[4.5rem_1fr_1fr_1.4fr] gap-2 border-b border-rose-50 px-3 py-2 last:border-0">
                    <span>{item.row || 'Upload'}</span>
                    <span className="truncate" title={item.email || ''}>{item.email || 'Not provided'}</span>
                    <span className="truncate" title={item.employeeId || ''}>{item.employeeId || 'Not provided'}</span>
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

function findDuplicateKeys(rows: Record<string, any>[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const row of rows) {
    const key = String(row.Email || row.email || row.Candidate_Email_Address || row.Employee_ID || row.employee_id || row.Candidate_ID || '').trim().toLowerCase()
    if (!key) continue
    if (seen.has(key)) duplicates.add(key)
    seen.add(key)
  }
  return duplicates
}

function downloadCandidateIssues(errors: Array<{ row?: number; error: string; email?: string; employeeId?: string }>, sourceName: string) {
  const header = ['Row', 'Candidate Email', 'Employee ID', 'Issue']
  const body = errors.map((item) => [item.row || '', item.email || '', item.employeeId || '', item.error])
  const csv = [header, ...body]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${sourceName.replace(/\.[^.]+$/, '')}-candidate-issues.csv`
  link.click()
  URL.revokeObjectURL(url)
}
