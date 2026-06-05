import { requireManagerForApi } from '@/lib/rbac'
import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const pastedText = formData.get('text') as string | null

    let extractedText = ''

    if (pastedText && pastedText.trim()) {
      extractedText = pastedText.trim()
    } else if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const fileName = file.name.toLowerCase()

      if (fileName.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer })
        extractedText = result.value
      } else if (fileName.endsWith('.pdf')) {
        const pdfParseModule = await import('pdf-parse')
        const parser = pdfParseModule.default ?? pdfParseModule
        const pdfData = await parser(buffer)
        extractedText = pdfData.text
      } else if (fileName.endsWith('.txt')) {
        extractedText = buffer.toString('utf-8')
      } else if (fileName.endsWith('.json')) {
        extractedText = jsonBufferToText(buffer)
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        extractedText = spreadsheetBufferToText(buffer)
      } else if (fileName.endsWith('.doc')) {
        return NextResponse.json({
          error: 'DOC files are not supported yet. Please use DOCX, PDF, TXT, XLSX, XLS, CSV, or JSON.'
        }, { status: 400 })
      } else {
        return NextResponse.json({
          error: 'Unsupported file type. Please upload PDF, DOCX, TXT, XLSX, XLS, CSV, or JSON files.'
        }, { status: 400 })
      }
    } else {
      return NextResponse.json({
        error: 'No content provided. Please upload a file or paste text.'
      }, { status: 400 })
    }

    extractedText = cleanExtractedText(extractedText)

    if (!extractedText || extractedText.length < 50) {
      return NextResponse.json({
        error: 'Extracted content is too short. Please provide more content (at least 50 characters).' 
      }, { status: 400 })
    }

    return NextResponse.json({
      text: extractedText,
      wordCount: extractedText.split(/\s+/).filter(Boolean).length,
      charCount: extractedText.length,
      lineCount: extractedText.split('\n').filter(Boolean).length,
    })
  } catch (error: any) {
    console.error('Content extraction error:', error)
    return NextResponse.json({
      error: `Failed to extract content: ${error.message}`
    }, { status: 500 })
  }
}

function spreadsheetBufferToText(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sections: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    })

    if (rows.length === 0) continue

    const renderedRows = rows
      .map((row) => row.map((cell) => String(cell ?? '').trim()).filter(Boolean).join(' | '))
      .filter(Boolean)

    if (renderedRows.length > 0) {
      sections.push(`Sheet: ${sheetName}\n${renderedRows.join('\n')}`)
    }
  }

  return sections.join('\n\n')
}

function jsonBufferToText(buffer: Buffer) {
  const parsed = JSON.parse(buffer.toString('utf-8'))
  return jsonToText(parsed)
}

function jsonToText(value: unknown, label = 'JSON'): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${label}: ${String(value)}`
  }

  if (Array.isArray(value)) {
    return value
      .map((item, index) => jsonToText(item, `${label} ${index + 1}`))
      .filter(Boolean)
      .join('\n\n')
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    const knownQuestionKeys = ['question_text', 'question', 'prompt', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'answer', 'difficulty', 'explanation']
    const hasQuestionShape = knownQuestionKeys.some((key) => key in (value as Record<string, unknown>))

    if (hasQuestionShape) {
      return entries
        .map(([key, item]) => `${key}: ${Array.isArray(item) || typeof item === 'object' ? jsonToText(item, key) : String(item ?? '')}`)
        .join('\n')
    }

    return entries
      .map(([key, item]) => jsonToText(item, key))
      .filter(Boolean)
      .join('\n')
  }

  return ''
}

function cleanExtractedText(text: string) {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/-\n(?=[a-z])/g, '')
    .replace(/[ \t]*\n[ \t]*/g, '\n')

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const repeated = new Map<string, number>()
  for (const line of lines) {
    repeated.set(line, (repeated.get(line) || 0) + 1)
  }

  return lines
    .filter((line) => {
      const lower = line.toLowerCase()
      if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(line)) return false
      if (/^\d+$/.test(line)) return false
      if ((repeated.get(line) || 0) > 2 && line.length < 80) return false
      return !['confidential', 'draft'].includes(lower)
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
