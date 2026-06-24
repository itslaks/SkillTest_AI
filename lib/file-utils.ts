import * as XLSX from 'xlsx'

export const UNIVERSAL_UPLOAD_ACCEPT = '.csv,.txt,.xlsx,.xls,.json,.xml,.pdf,.docx'
export const STRUCTURED_UPLOAD_ACCEPT = '.csv,.txt,.xlsx,.xls,.json,.xml'
export const EXCEL_WITH_OPTIONAL_TEXT_ACCEPT = '.xlsx,.xls,.csv,.txt'
export const DOCUMENT_UPLOAD_ACCEPT = '.pdf,.docx'

const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv']
const TEXT_EXTENSIONS = ['.txt']
const STRUCTURED_EXTENSIONS = [...SPREADSHEET_EXTENSIONS, ...TEXT_EXTENSIONS, '.json', '.xml']
const DOCUMENT_EXTENSIONS = ['.pdf', '.docx']

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
  if (Array.isArray(parsed?.employees)) return parsed.employees
  if (Array.isArray(parsed?.records)) return parsed.records
  if (Array.isArray(parsed?.rows)) return parsed.rows
  if (Array.isArray(parsed?.candidates)) return parsed.candidates
  if (Array.isArray(parsed?.attendance)) return parsed.attendance
  if (Array.isArray(parsed?.scores)) return parsed.scores
  return []
}

export async function parseXmlFile(file: File) {
  return xmlTextToRows(await file.text())
}

export function xmlTextToRows(rawXml: string) {
  const rows = parseXmlWithDom(rawXml)
  if (rows.length > 0) return rows

  const text = xmlToPlainText(rawXml)
  return parseTextToRows(text)
}

function parseXmlWithDom(rawXml: string) {
  if (typeof DOMParser === 'undefined') return []
  const parser = new DOMParser()
  const doc = parser.parseFromString(rawXml, 'application/xml')
  if (doc.querySelector('parsererror')) return []

  const candidateNodes = Array.from(doc.querySelectorAll('question, employee, candidate, attendance, score, row, record, item'))
  const nodes = candidateNodes.length > 0 ? candidateNodes : Array.from(doc.documentElement.children)

  return nodes
    .map((node) => elementToRow(node))
    .filter((row) => Object.keys(row).length > 0)
}

function elementToRow(element: Element) {
  const row: Record<string, string> = {}

  for (const attribute of Array.from(element.attributes)) {
    row[normalizeHeader(attribute.name)] = attribute.value.trim()
  }

  for (const child of Array.from(element.children)) {
    const key = normalizeHeader(child.tagName)
    const value = child.children.length > 0
      ? Array.from(child.children).map((nested) => nested.textContent?.trim()).filter(Boolean).join(' | ')
      : child.textContent?.trim()
    if (key && value) row[key] = value
  }

  if (Object.keys(row).length === 0 && element.textContent?.trim()) {
    row[normalizeHeader(element.tagName)] = element.textContent.trim()
  }

  return row
}

export function xmlToPlainText(rawXml: string) {
  return rawXml
    .replace(/<\?xml[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<\/(question|employee|candidate|attendance|score|row|record|item)>/gi, '\n\n')
    .replace(/<([^/\s>]+)[^>]*>/g, '$1: ')
    .replace(/<\/[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
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

export function parseMarkdownMcqText(text: string) {
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[✅✔✓]/g, ' [correct]')
    .trim()

  if (!cleaned) return []

  const questionBlocks = cleaned
    .split(/\n\s*---+\s*\n|\n(?=\s*(?:\*\*)?\d{1,3}[.)]\s+)/g)
    .map((block) => block.trim())
    .filter(Boolean)

  const rows: Record<string, string>[] = []

  for (const block of questionBlocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    const questionIndex = lines.findIndex((line) => /^(?:\*\*)?\d{1,3}[.)]\s+/.test(line))
    if (questionIndex < 0) continue

    const questionText = stripMarkdown(lines[questionIndex].replace(/^(?:\*\*)?\d{1,3}[.)]\s+/, ''))
    const optionMap: Record<string, string> = {}
    let correctAnswer = ''
    let explanation = ''

    for (const line of lines.slice(questionIndex + 1)) {
      const plainLine = stripMarkdown(line)
      const option = plainLine.match(/^([A-Da-d])[.)]\s+(.+)$/)
      if (option) {
        const key = option[1].toUpperCase()
        const value = stripMarkdown(option[2].replace(/\s*\[correct\]\s*/i, ''))
        optionMap[key] = value
        if (/\[correct\]/i.test(line)) correctAnswer = key
        continue
      }

      const correct = plainLine.match(/^Correct\s+Answer\s*[:\-]\s*([A-Da-d])(?:[.)])?\s*(.*)$/i)
      if (correct) {
        correctAnswer = correct[1].toUpperCase()
        continue
      }

      const answer = plainLine.match(/^Answer\s*[:\-]\s*([A-Da-d])(?:[.)])?\s*(.*)$/i)
      if (answer) {
        correctAnswer = answer[1].toUpperCase()
        continue
      }

      const reason = plainLine.match(/^(?:Explanation|Reason|Rationale)\s*[:\-]\s*(.+)$/i)
      if (reason) explanation = stripMarkdown(reason[1])
    }

    if (!questionText || !optionMap.A || !optionMap.B || !optionMap.C || !optionMap.D) continue

    rows.push({
      question_text: questionText,
      question: questionText,
      option_a: optionMap.A,
      option_b: optionMap.B,
      option_c: optionMap.C,
      option_d: optionMap.D,
      correct_answer: correctAnswer || 'A',
      explanation,
    })
  }

  return rows
}

function stripMarkdown(value: string) {
  return value
    .replace(/\s*\[correct\]\s*/gi, '')
    .replace(/^\*\*|\*\*$/g, '')
    .replace(/\*\*/g, '')
    .replace(/^["']|["']$/g, '')
    .trim()
}

export async function parseUniversalRowsFile(file: File) {
  const fileName = file.name.toLowerCase()

  if (SPREADSHEET_EXTENSIONS.some((extension) => fileName.endsWith(extension))) {
    return parseSpreadsheetFile(file)
  }

  if (TEXT_EXTENSIONS.some((extension) => fileName.endsWith(extension))) {
    const text = await file.text()
    const mcqRows = parseMarkdownMcqText(text)
    if (mcqRows.length > 0) return mcqRows
    const rows = parseTextToRows(text)
    return rows.length > 0 ? rows : parseKeyValueText(text)
  }

  if (fileName.endsWith('.json')) {
    return parseJsonFile(file)
  }

  if (fileName.endsWith('.xml')) {
    return parseXmlFile(file)
  }

  if (DOCUMENT_EXTENSIONS.some((extension) => fileName.endsWith(extension))) {
    const text = await extractTextFromFile(file)
    const mcqRows = parseMarkdownMcqText(text)
    if (mcqRows.length > 0) return mcqRows
    const rows = parseTextToRows(text)
    if (rows.length > 0) return rows
    return parseKeyValueText(text)
  }

  throw new Error(`Unsupported file type. Please upload ${UNIVERSAL_UPLOAD_ACCEPT.replaceAll('.', '').toUpperCase()} files.`)
}

export function isStructuredUpload(file: File) {
  const name = file.name.toLowerCase()
  return STRUCTURED_EXTENSIONS.some((extension) => name.endsWith(extension))
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
