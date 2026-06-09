const fs = require('fs')
const path = require('path')

const rowCount = Number(process.argv[2] || 20000)
const outDir = path.join(process.cwd(), 'tmp', 'tms-fixtures')
fs.mkdirSync(outDir, { recursive: true })

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function writeCsv(fileName, header, rows) {
  const csv = [header, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n')
  const filePath = path.join(outDir, fileName)
  fs.writeFileSync(filePath, csv)
  console.log(filePath)
}

const candidates = Array.from({ length: rowCount }, (_, index) => {
  const n = index + 1
  return {
    email: `candidate${String(n).padStart(5, '0')}@example.com`,
    employeeId: `TMS${String(n).padStart(5, '0')}`,
    name: `Candidate ${n}`,
  }
})

writeCsv(
  'candidate-master-20000.csv',
  ['Email', 'Employee_ID', 'Full_Name', 'Department'],
  candidates.map((candidate) => [candidate.email, candidate.employeeId, candidate.name, 'Training'])
)

writeCsv(
  'attendance-20000.csv',
  ['Email', 'Employee_ID', 'Status', 'Notes'],
  candidates.map((candidate, index) => [
    candidate.email,
    candidate.employeeId,
    index % 17 === 0 ? 'absent' : index % 11 === 0 ? 'late' : 'present',
    '',
  ])
)

writeCsv(
  'assessment-scores-20000.csv',
  ['Candidate_Email_Address', 'Candidate_ID', 'Candidate_Full_Name', 'Test_Name', 'Candidate_Score', 'Percentage'],
  candidates.map((candidate, index) => {
    const score = 55 + (index % 46)
    return [candidate.email, candidate.employeeId, candidate.name, 'Sprint Review Scale Test', score, score]
  })
)
