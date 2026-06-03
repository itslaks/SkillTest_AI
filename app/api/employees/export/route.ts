import { downloadEmployeeReport } from '@/lib/backend/controllers/employee-controller'

export async function GET() {
  return downloadEmployeeReport()
}
