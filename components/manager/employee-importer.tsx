'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { importEmployees } from '@/lib/actions/manager'
import { Upload, Users, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

interface ImportResult {
  total: number
  successful: number
  failed: number
  errors: { row: number; email: string; error: string }[]
}

export function EmployeeImporter() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ImportResult | null>(null)
  const [preview, setPreview] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<any>(sheet)

        if (json.length === 0) {
          setError('Excel file is empty')
          return
        }

        // Normalize column names
        const normalized = json.map((row: any) => ({
          email: (row.email || row.Email || row.EMAIL || '').toString().trim().toLowerCase(),
          full_name: (row.name || row.Name || row.full_name || row['Full Name'] || '').toString().trim(),
          domain: (row.domain || row.Domain || row.DOMAIN || row.department || row.Department || '').toString().trim(),
          employee_id: (row.employee_id || row['Employee ID'] || row.employeeId || row.ID || '').toString().trim() || undefined,
        }))

        setPreview(normalized.slice(0, 5))

        // Show full preview then allow upload
        setPreview(normalized)
      } catch (err) {
        setError('Failed to parse Excel file. Ensure it has columns: email, name, domain')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleUpload() {
    if (!preview) return

    setError(null)
    startTransition(async () => {
      const res = await importEmployees(preview)
      if (res.error) {
        setError(res.error)
      } else if (res.data) {
        setResult(res.data)
        setPreview(null)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          Import Employees
        </CardTitle>
        <CardDescription>
          Upload an Excel file with columns: <strong>email</strong>, <strong>name</strong>, <strong>domain</strong>
          {' '}(optional: <strong>employee_id</strong>). Employees will be auto-categorized by domain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
        )}

        {result && (
          <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20 space-y-2">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Import Complete</span>
            </div>
            <p className="text-sm">
              {result.successful} of {result.total} employees processed successfully.
              {result.failed > 0 && ` ${result.failed} failed.`}
            </p>
            {result.errors.length > 0 && (
              <div className="mt-2 text-sm">
                <p className="font-medium text-red-600">Errors:</p>
                {result.errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-red-500">Row {err.row}: {err.email} - {err.error}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed cursor-pointer hover:bg-muted transition-colors">
            <Upload className="h-4 w-4" />
            <span className="text-sm">Choose Excel File</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {preview && preview.length > 0 && (
            <Button onClick={handleUpload} disabled={isPending}>
              {isPending ? <Spinner className="mr-2" /> : <Users className="mr-2 h-4 w-4" />}
              Import {preview.length} Employees
            </Button>
          )}
        </div>

        {/* Preview */}
        {preview && preview.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <p className="text-sm font-medium mb-2">Preview ({Math.min(preview.length, 10)} of {preview.length}):</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Email</th>
                  <th className="text-left p-2 font-medium">Name</th>
                  <th className="text-left p-2 font-medium">Domain</th>
                  <th className="text-left p-2 font-medium">ID</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{row.email}</td>
                    <td className="p-2">{row.full_name}</td>
                    <td className="p-2"><Badge variant="outline" className="text-xs">{row.domain || 'N/A'}</Badge></td>
                    <td className="p-2 text-muted-foreground">{row.employee_id || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
