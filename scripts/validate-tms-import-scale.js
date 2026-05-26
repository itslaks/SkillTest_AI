const fs = require('fs')
const path = require('path')

const expectedRows = Number(process.argv[2] || 20000)
const fixtureDir = path.join(process.cwd(), 'tmp', 'tms-fixtures')
const files = [
  'candidate-master-20000.csv',
  'attendance-20000.csv',
  'assessment-scores-20000.csv',
]

function countDataRows(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  if (!content.trim()) return 0
  return Math.max(0, content.split(/\r?\n/).filter(Boolean).length - 1)
}

const startedAt = performance.now()
const results = files.map((file) => {
  const filePath = path.join(fixtureDir, file)
  if (!fs.existsSync(filePath)) {
    throw new Error(`${file} is missing. Run npm run fixtures:tms first.`)
  }
  const rows = countDataRows(filePath)
  if (rows !== expectedRows) {
    throw new Error(`${file} has ${rows} rows; expected ${expectedRows}.`)
  }
  return { file, rows, sizeMb: fs.statSync(filePath).size / (1024 * 1024) }
})
const elapsedMs = Math.round(performance.now() - startedAt)

console.log('TMS import scale fixture validation passed')
for (const result of results) {
  console.log(`${result.file}: ${result.rows.toLocaleString()} rows, ${result.sizeMb.toFixed(2)} MB`)
}
console.log(`Validation time: ${elapsedMs}ms`)
