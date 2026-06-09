const fs = require('fs')
const path = require('path')

const outDir = path.join(process.cwd(), 'tmp', 'contest-demo-fixtures')
fs.mkdirSync(outDir, { recursive: true })

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function writeCsv(fileName, header, rows) {
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
  const filePath = path.join(outDir, fileName)
  fs.writeFileSync(filePath, csv)
  console.log(filePath)
}

const candidates = [
  ['Aarav Mehta', 'aarav.mehta@demo.skilltest.ai', 'MEP001', 'Cloud Native'],
  ['Isha Rao', 'isha.rao@demo.skilltest.ai', 'MEP002', 'Cloud Native'],
  ['Kabir Sinha', 'kabir.sinha@demo.skilltest.ai', 'MEP003', 'Cloud Native'],
  ['Meera Nair', 'meera.nair@demo.skilltest.ai', 'MEP004', 'Cloud Native'],
  ['Rohan Das', 'rohan.das@demo.skilltest.ai', 'MEP005', 'Cloud Native'],
  ['Tara Menon', 'tara.menon@demo.skilltest.ai', 'MEP006', 'API Engineering'],
  ['Vihaan Kapoor', 'vihaan.kapoor@demo.skilltest.ai', 'MEP007', 'API Engineering'],
  ['Nisha Verma', 'nisha.verma@demo.skilltest.ai', 'MEP008', 'API Engineering'],
  ['Dev Iyer', 'dev.iyer@demo.skilltest.ai', 'MEP009', 'API Engineering'],
  ['Anaya Shah', 'anaya.shah@demo.skilltest.ai', 'MEP010', 'API Engineering'],
]

writeCsv(
  '01-candidate-master.csv',
  ['Email', 'Employee_ID', 'Full_Name', 'Department'],
  candidates.map(([name, email, employeeId, department]) => [email, employeeId, name, department])
)

writeCsv(
  '02-batch-alpha-candidates.csv',
  ['Email', 'Employee_ID', 'Enrollment_Status', 'Support_Status'],
  candidates.slice(0, 5).map(([name, email, employeeId], index) => [
    email,
    employeeId,
    index === 4 ? 'not_cleared' : 'active',
    index === 3 ? 'needs_support' : 'healthy',
  ])
)

writeCsv(
  '03-batch-beta-candidates.csv',
  ['Email', 'Employee_ID', 'Enrollment_Status', 'Support_Status'],
  candidates.slice(5).map(([name, email, employeeId], index) => [
    email,
    employeeId,
    index === 3 ? 'discontinued' : index === 4 ? 'offered' : 'active',
    index === 1 ? 'watch' : 'healthy',
  ])
)

writeCsv(
  '04-alpha-attendance-day-1.csv',
  ['Email', 'Employee_ID', 'Status', 'Notes'],
  candidates.slice(0, 5).map(([name, email, employeeId], index) => [
    email,
    employeeId,
    index === 3 ? 'absent' : index === 4 ? 'late' : 'present',
    index === 3 ? 'First absence for intervention demo' : '',
  ])
)

writeCsv(
  '05-alpha-attendance-day-2.csv',
  ['Email', 'Employee_ID', 'Status', 'Notes'],
  candidates.slice(0, 5).map(([name, email, employeeId], index) => [
    email,
    employeeId,
    index === 3 ? 'absent' : 'present',
    index === 3 ? 'Second consecutive absence' : '',
  ])
)

writeCsv(
  '06-alpha-attendance-day-3.csv',
  ['Email', 'Employee_ID', 'Status', 'Notes'],
  candidates.slice(0, 5).map(([name, email, employeeId], index) => [
    email,
    employeeId,
    index === 3 ? 'absent' : 'present',
    index === 3 ? 'Third consecutive absence - automation should flag' : '',
  ])
)

writeCsv(
  '07-assessment-scores-sprint-review.csv',
  ['Candidate_Email_Address', 'Candidate_ID', 'Candidate_Full_Name', 'Test_Name', 'Candidate_Score', 'Percentage'],
  candidates.map(([name, email, employeeId], index) => {
    const score = [96, 88, 82, 61, 55, 93, 79, 72, 48, 90][index]
    return [email, employeeId, name, 'Sprint Review - Demo', score, score]
  })
)

writeCsv(
  '08-project-evaluation-reference.csv',
  ['Candidate_Email_Address', 'Candidate_ID', 'Candidate_Full_Name', 'Project_Title', 'Project_Score', 'Evidence_File_Name'],
  candidates.map(([name, email, employeeId], index) => {
    const score = [94, 84, 80, 58, 62, 91, 76, 74, 45, 89][index]
    return [email, employeeId, name, 'Mavericks Capstone API', score, `${employeeId.toLowerCase()}-capstone-evidence.pdf`]
  })
)

console.log('\nDemo fixture sequence:')
console.log('1. Import 01-candidate-master.csv in Employees.')
console.log('2. Create two batches, then import 02 and 03 in Training Ops.')
console.log('3. Create three attendance-required sessions for Alpha; upload 04, 05, 06.')
console.log('4. Create a sprint review assessment setup; upload 07.')
console.log('5. Add project evaluations from 08, then run governance automation and download the evidence pack.')
