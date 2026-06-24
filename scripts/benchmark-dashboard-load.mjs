const started = performance.now()
const candidates = 20000
const batches = 24
const trainers = 12

const members = Array.from({ length: candidates }, (_, index) => ({
  batch_id: `batch-${index % batches}`,
  enrollment_status: index % 17 === 0 ? 'discontinued' : index % 13 === 0 ? 'not_cleared' : index % 11 === 0 ? 'offered' : index % 7 === 0 ? 'onboarded' : 'active',
}))

const attendance = Array.from({ length: candidates * 3 }, (_, index) => ({
  batch_id: `batch-${index % batches}`,
  status: index % 9 === 0 ? 'absent' : 'present',
}))

const assessments = Array.from({ length: candidates }, (_, index) => ({
  batch_id: `batch-${index % batches}`,
  trainer_id: `trainer-${index % trainers}`,
  percentage: 45 + (index % 56),
}))

const summary = {
  totalCandidates: members.length,
  discontinued: members.filter((row) => row.enrollment_status === 'discontinued').length,
  notCleared: members.filter((row) => row.enrollment_status === 'not_cleared').length,
  offeredOnboarded: members.filter((row) => ['offered', 'onboarded'].includes(row.enrollment_status)).length,
  remaining: members.filter((row) => row.enrollment_status === 'active').length,
  attendanceByBatch: aggregateRate(attendance, 'batch_id', (row) => row.status === 'present'),
  clearanceByBatch: aggregateRate(assessments, 'batch_id', (row) => row.percentage >= 70),
  trainerPerformance: aggregateAverage(assessments, 'trainer_id', 'percentage'),
}

const elapsed = Math.round(performance.now() - started)
console.log(JSON.stringify({ passed: elapsed < 5000, elapsedMs: elapsed, volume: { candidates, attendanceRows: attendance.length, assessmentRows: assessments.length }, sample: Object.keys(summary.attendanceByBatch).slice(0, 3) }, null, 2))
if (elapsed >= 5000) process.exit(1)

function aggregateRate(rows, key, predicate) {
  const grouped = {}
  for (const row of rows) {
    grouped[row[key]] ||= { total: 0, pass: 0 }
    grouped[row[key]].total++
    if (predicate(row)) grouped[row[key]].pass++
  }
  return Object.fromEntries(Object.entries(grouped).map(([name, value]) => [name, Math.round((value.pass / value.total) * 100)]))
}

function aggregateAverage(rows, key, valueKey) {
  const grouped = {}
  for (const row of rows) {
    grouped[row[key]] ||= { total: 0, sum: 0 }
    grouped[row[key]].total++
    grouped[row[key]].sum += row[valueKey]
  }
  return Object.fromEntries(Object.entries(grouped).map(([name, value]) => [name, Math.round(value.sum / value.total)]))
}
