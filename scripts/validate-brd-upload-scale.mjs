import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'

const expectedRows = Number(process.argv[2] || 20000)
const fixtureDir = path.join(process.cwd(), 'tmp', 'brd-fixtures')
const chunkSize = 1000
const started = Date.now()

const files = [
  { name: 'candidate-master-20000.xlsx', type: 'candidate' },
  { name: 'attendance-20000.xlsx', type: 'attendance' },
  { name: 'assessment-scores-20000.xlsx', type: 'assessment' },
]

for (const file of files) {
  const fullPath = path.join(fixtureDir, file.name)
  if (!fs.existsSync(fullPath)) throw new Error(`Missing fixture: ${fullPath}`)
  const rows = readRows(fullPath)
  if (rows.length !== expectedRows) throw new Error(`${file.name}: expected ${expectedRows}, found ${rows.length}`)
  const errors = validateRows(file.type, rows)
  if (errors.length) throw new Error(`${file.name}: validation failed: ${errors.slice(0, 5).join('; ')}`)
  const chunks = Math.ceil(rows.length / chunkSize)
  console.log(`${file.name}: ${rows.length} rows parsed and validated in ${chunks} chunk(s).`)
}

console.log(`BRD 20,000-row XLSX validation passed in ${Date.now() - started}ms.`)

function readRows(file) {
  const workbook = XLSX.read(fs.readFileSync(file))
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet)
}

function validateRows(type, rows) {
  const errors = []
  const seen = new Set()
  rows.forEach((row, index) => {
    const rowNum = index + 2
    const employeeId = String(row.Employee_ID || row.Candidate_ID || '').trim()
    const email = String(row.Candidate_Email_Address || '').trim().toLowerCase()
    const key = employeeId || email
    if (!key) errors.push(`row ${rowNum}: missing candidate identifier`)
    if (seen.has(key)) errors.push(`row ${rowNum}: duplicate candidate identifier`)
    seen.add(key)
    if (type === 'attendance' && !['present', 'absent', 'late', 'excused'].includes(String(row.Status || '').toLowerCase())) {
      errors.push(`row ${rowNum}: invalid attendance status`)
    }
    if (type === 'assessment') {
      const percentage = Number(row.Percentage)
      const score = Number(row.Candidate_Score)
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100 || !Number.isFinite(score) || score < 0) {
        errors.push(`row ${rowNum}: invalid score range`)
      }
    }
  })
  return errors
}
