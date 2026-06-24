import fs from 'node:fs'
import path from 'node:path'
import * as XLSX from 'xlsx'

const rowCount = Number(process.argv[2] || 20000)
const outDir = path.join(process.cwd(), 'tmp', 'brd-fixtures')
fs.mkdirSync(outDir, { recursive: true })

const candidates = Array.from({ length: rowCount }, (_, index) => {
  const n = index + 1
  return {
    Employee_ID: `EMP${String(n).padStart(5, '0')}`,
    Candidate_Email_Address: `candidate${n}@example.com`,
    Candidate_Full_Name: `Candidate ${n}`,
    Domain: n % 2 === 0 ? 'Java' : 'Data Engineering',
  }
})

const attendance = candidates.map((candidate, index) => ({
  Employee_ID: candidate.Employee_ID,
  Candidate_Email_Address: candidate.Candidate_Email_Address,
  Status: index % 11 === 0 ? 'absent' : index % 7 === 0 ? 'late' : 'present',
  Notes: index % 7 === 0 ? 'Late arrival recorded for BRD scale validation' : '',
}))

const assessments = candidates.map((candidate, index) => {
  const score = 45 + (index % 56)
  return {
    Candidate_ID: candidate.Employee_ID,
    Candidate_Email_Address: candidate.Candidate_Email_Address,
    Candidate_Full_Name: candidate.Candidate_Full_Name,
    Test_Id: 'BRD-ASSESSMENT-001',
    Test_Name: 'BRD Scale Assessment',
    Candidate_Score: score,
    Percentage: score,
    Total_Questions: 100,
    Correct: score,
    Wrong: 100 - score,
  }
})

writeWorkbook('candidate-master-20000.xlsx', 'Candidates', candidates)
writeWorkbook('attendance-20000.xlsx', 'Attendance', attendance)
writeWorkbook('assessment-scores-20000.xlsx', 'Assessment Scores', assessments)

console.log(`Generated ${rowCount.toLocaleString()}-row BRD XLSX fixtures in ${outDir}`)

function writeWorkbook(fileName, sheetName, rows) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName)
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true })
  fs.writeFileSync(path.join(outDir, fileName), buffer)
}
