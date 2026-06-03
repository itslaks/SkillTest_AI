import { fetchEmployeesForReport } from '@/lib/backend/repositories/employee-repository'
import { buildEmployeeReportWorkbook } from '@/lib/backend/services/employee-report-service'
import { requireManagerForApi } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export async function downloadEmployeeReport() {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  const result = await fetchEmployeesForReport(auth)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error || 'Unable to build employee report.' }, { status: 500 })
  }

  const buffer = buildEmployeeReportWorkbook(result.data)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="employees-report.xlsx"',
    },
  })
}
