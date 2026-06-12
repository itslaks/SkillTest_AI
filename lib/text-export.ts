type ExportRow = Record<string, unknown>

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\r?\n/g, ' ').replace(/\t/g, ' ').trim()
}

export function rowsToTxt(rows: ExportRow[], emptyMessage = 'No records found') {
  if (rows.length === 0) return `${emptyMessage}\n`

  const headers = Object.keys(rows[0])
  const lines = [
    headers.join('\t'),
    ...rows.map((row) => headers.map((header) => normalizeCell(row[header])).join('\t')),
  ]

  return `${lines.join('\n')}\n`
}

export function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
