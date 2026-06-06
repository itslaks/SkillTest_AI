import { requireTrainingStaffForApi } from '@/lib/rbac'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const auth = await requireTrainingStaffForApi()
  if (auth instanceof NextResponse) return auth

  const rows = [
    {
      Email: 'candidate@company.com',
      Employee_ID: 'EMP001',
      Status: 'present',
      Notes: 'Optional remarks',
    },
    {
      Email: 'candidate2@company.com',
      Employee_ID: 'EMP002',
      Status: 'absent',
      Notes: 'Optional remarks',
    },
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Upload')
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="attendance-upload-template.xlsx"',
    },
  })
}
