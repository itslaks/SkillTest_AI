import * as XLSX from 'xlsx'

export function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function getCell(row: Record<string, any>, aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader))
  const key = Object.keys(row).find((candidate) => normalizedAliases.has(normalizeHeader(String(candidate))))
  const value = key ? row[key] : undefined
  return value === null || value === undefined ? '' : String(value).trim()
}

export async function parseSpreadsheetFile(file: File) {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data)
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const worksheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<Record<string, string | number | boolean | null>>(worksheet)
}

export async function parseJsonFile(file: File) {
  const raw = await file.text()
  const parsed = JSON.parse(raw)
  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed?.questions)) return parsed.questions
  return []
}

function detectDelimiter(line: string): string {
  const delimiters = ['\t', '|', ';', ',']
  for (const delimiter of delimiters) {
    if (line.includes(delimiter)) return delimiter
  }
  return ','
}

export function parseTextToRows(text: string) {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '\t')
    .replace(/\u00a0/g, ' ')
    .trim()

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const delimiter = detectDelimiter(lines[0])
  const headerLine = lines[0].split(delimiter).map((header) => normalizeHeader(header))
  const rows = lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((value) => value.trim())
    const row: Record<string, string> = {}
    headerLine.forEach((key, index) => {
      row[key] = values[index] ?? ''
    })
    return row
  })

  return rows
}

export function parseKeyValueText(text: string) {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.map((block) => {
    const row: Record<string, string> = {}
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    for (const line of lines) {
      const parts = line.split(/[:|-]\s*/)
      if (parts.length >= 2) {
        const key = normalizeHeader(parts[0])
        const value = parts.slice(1).join(': ').trim()
        row[key] = value
      }
    }
    return row
  }).filter((row) => Object.keys(row).length > 0)
}

export async function extractTextFromFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/extract-content', { method: 'POST', body: formData })
  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.error || 'Failed to extract content from file.')
  }

  return result.text as string
}
