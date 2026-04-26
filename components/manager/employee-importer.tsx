'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { importEmployees } from '@/lib/actions/manager'
import type { EmployeeImport, EmployeeImportResult } from '@/lib/types/database'
import { Upload, Users, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

type SpreadsheetRow = Record<string, string | number | boolean | null | undefined>
type EmployeeImportPreview = EmployeeImport & { s_no: string }

const EMPLOYEE_COLUMNS = {
  serial: ['s.no', 'sno', 'serial', 'serialno', 'no'],
  email: ['email', 'emailaddress', 'mail', 'mailid', 'employeeemail', 'candidateemailaddress'],
  name: ['name', 'fullname', 'full_name', 'employeename', 'candidatefullname'],
  domain: ['domain', 'department', 'team', 'businessunit', 'skilldomain'],
  employeeId: ['employeeid', 'employee_id', 'empid', 'id', 'staffid'],
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function getCell(row: SpreadsheetRow, aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader))
  const key = Object.keys(row).find((candidate) => normalizedAliases.has(normalizeHeader(candidate)))
  const value = key ? row[key] : undefined
  return value === null || value === undefined ? '' : String(value).trim()
}

export function EmployeeImporter() {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<EmployeeImportResult | null>(null)
  const [preview, setPreview] = useState<EmployeeImportPreview[] | null>(null)
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
        const json = XLSX.utils.sheet_to_json<SpreadsheetRow>(sheet)

        if (json.length === 0) {
          setError('Excel file is empty')
          return
        }

        const normalized: EmployeeImportPreview[] = json.map((row) => ({
          s_no: getCell(row, EMPLOYEE_COLUMNS.serial),
          email: getCell(row, EMPLOYEE_COLUMNS.email).toLowerCase(),
          full_name: getCell(row, EMPLOYEE_COLUMNS.name),
          domain: getCell(row, EMPLOYEE_COLUMNS.domain) || 'General',
          employee_id: getCell(row, EMPLOYEE_COLUMNS.employeeId) || undefined,
        }))
        const seenEmails = new Set<string>()
        const validRows: EmployeeImportPreview[] = []
        const rowErrors: string[] = []

        normalized.forEach((row, index) => {
          const rowNumber = row.s_no || String(index + 1)
          if (!row.email || !row.full_name) {
            rowErrors.push(`Row ${rowNumber}: missing email or name`)
            return
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            rowErrors.push(`Row ${rowNumber}: invalid email`)
            return
          }
          if (seenEmails.has(row.email)) {
            rowErrors.push(`Row ${rowNumber}: duplicate email`)
            return
          }
          seenEmails.add(row.email)
          validRows.push(row)
        })

        if (validRows.length === 0) {
          setError(`No valid employees found. Accepted columns: Email, name/full_name, domain/department, employee_id. ${rowErrors.slice(0, 3).join('; ')}`)
          return
        }

        setPreview(validRows)
        if (rowErrors.length > 0) {
          setError(`${rowErrors.length} row(s) skipped: ${rowErrors.slice(0, 3).join('; ')}`)
        }
      } catch {
        setError('Failed to parse file. Use Excel or CSV with Email and name columns.')
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
          Upload Excel or CSV with <strong>Email</strong> and <strong>name</strong>.
          Optional columns: <strong>domain</strong>, <strong>department</strong>, <strong>employee_id</strong>.
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
                Import {preview.length} Valid Employees
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

