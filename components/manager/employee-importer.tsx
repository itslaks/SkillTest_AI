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
  const [isDragging, setIsDragging] = useState(false)

  function processFile(file: File) {
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

        // Normalize column names to match user's s.no, Email, name requirement
        const normalized = json.map((row: any) => ({
          s_no: (row['s.no'] || row['S.No'] || row.sno || row.Serial || '').toString().trim(),
          email: (row.Email || row.email || row.EMAIL || '').toString().trim().toLowerCase(),
          full_name: (row.name || row.Name || row.full_name || row['Full Name'] || '').toString().trim(),
          domain: (row.domain || row.Domain || row.DOMAIN || row.department || row.Department || '').toString().trim(),
          employee_id: (row.employee_id || row['Employee ID'] || row.employeeId || row.ID || '').toString().trim() || undefined,
        }))

        // Validation for required columns
        const firstValid = normalized[0]
        if (!firstValid.email || !firstValid.full_name) {
          setError('Excel must contain "Email" and "name" columns.')
          return
        }

        setPreview(normalized)
      } catch (err) {
        setError('Failed to parse Excel file. Ensure it has columns: email, name, domain')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
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
        <CardTitle className="flex items-center gap-2 text-2xl font-bold">
          <FileSpreadsheet className="h-6 w-6 text-green-600" />
          Import Employees
        </CardTitle>
        <CardDescription className="text-base mt-2">
          Upload an Excel file with columns: <strong>s.no</strong>, <strong>Email</strong>, <strong>name</strong>
          {' '}(optional: <strong>domain</strong>, <strong>employee_id</strong>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
            <XCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="p-5 rounded-xl border-2 border-green-500/20 bg-green-500/5 space-y-3">
            <div className="flex items-center gap-3 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-6 w-6" />
              <span className="font-bold text-lg">Import Complete</span>
            </div>
            <p className="text-muted-foreground">
              {result.successful} of {result.total} employees processed successfully.
              {result.failed > 0 && ` ${result.failed} failed.`}
            </p>
            {result.errors.length > 0 && (
              <div className="mt-3 p-3 bg-red-500/5 rounded-lg border border-red-500/10 text-sm">
                <p className="font-bold text-red-600 mb-2">Errors:</p>
                {result.errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-red-500 font-mono">Row {err.row}: {err.email} - {err.error}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 text-center ${
            isDragging 
              ? "border-primary bg-primary/10 scale-[1.02]" 
              : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full transition-colors ${isDragging ? "bg-primary/20" : "bg-muted"}`}>
              <Upload className={`h-10 w-10 ${isDragging ? "text-primary animate-bounce" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-xl font-display font-medium mb-1">
                {isDragging ? "Drop it here!" : "Drag & drop your Excel file"}
              </p>
              <p className="text-muted-foreground mt-2">
                or click to browse your computer
              </p>
            </div>
            <label className="mt-4">
              <span className="px-6 py-2.5 bg-foreground text-background font-medium rounded-full cursor-pointer hover:opacity-90 transition-opacity">
                Select File
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {preview && preview.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Preview Records</h3>
              <Button 
                onClick={handleUpload} 
                disabled={isPending}
                size="lg"
                className="rounded-full px-8 bg-green-600 hover:bg-green-700 text-white font-bold"
              >
                {isPending ? <Spinner className="mr-2" /> : <Users className="mr-2 h-5 w-5" />}
                Import {preview.length} Employees
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-4 font-bold border-b">S.No</th>
                    <th className="text-left p-4 font-bold border-b">Email</th>
                    <th className="text-left p-4 font-bold border-b">Name</th>
                    <th className="text-left p-4 font-bold border-b text-center">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-mono text-xs">{row.s_no || i + 1}</td>
                      <td className="p-4 font-medium">{row.email}</td>
                      <td className="p-4">{row.full_name}</td>
                      <td className="p-4 text-center">
                        {row.employee_id ? (
                          <Badge variant="secondary">{row.employee_id}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 10 && (
                <div className="p-3 text-center bg-muted/20 text-xs text-muted-foreground border-t">
                  Showing first 10 of {preview.length} records.
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

