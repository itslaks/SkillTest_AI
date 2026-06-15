import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { requireTrainingStaffForApi } from '@/lib/rbac'

type ExportPayload = {
  format?: 'csv' | 'pdf'
  title?: string
  generatedAt?: string
  requestedBy?: string
  filters?: Record<string, string>
  content?: string
}

export async function POST(request: NextRequest) {
  const auth = await requireTrainingStaffForApi()
  if (auth instanceof NextResponse) return auth

  const payload = (await request.json()) as ExportPayload
  const title = sanitizeText(payload.title || 'AI Command Export')
  const generatedAt = payload.generatedAt || new Date().toISOString()
  const requestedBy = payload.requestedBy || auth.userId
  const content = sanitizeText(payload.content || 'No export content was provided.')
  const filters = payload.filters || {}
  const filename = `${slugify(title)}-${new Date(generatedAt).toISOString().slice(0, 10)}`

  if (payload.format === 'pdf') {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
    const margin = 40
    let y = margin
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(16)
    pdf.text(title, margin, y)
    y += 24
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(`Generated: ${new Date(generatedAt).toLocaleString('en-IN')}`, margin, y)
    y += 14
    pdf.text(`Requested by: ${requestedBy}`, margin, y)
    y += 18
    const filterText = Object.entries(filters).map(([key, value]) => `${key}: ${value}`).join(', ') || 'none'
    pdf.text(`Filters: ${filterText}`, margin, y)
    y += 24

    pdf.setFontSize(10)
    const lines = pdf.splitTextToSize(content, 515)
    for (const line of lines) {
      if (y > 780) {
        pdf.addPage()
        y = margin
      }
      pdf.text(line, margin, y)
      y += 14
    }

    const buffer = Buffer.from(pdf.output('arraybuffer'))
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    })
  }

  const csv = buildCsv(title, generatedAt, requestedBy, filters, content)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.csv"`,
    },
  })
}

function buildCsv(title: string, generatedAt: string, requestedBy: string, filters: Record<string, string>, content: string) {
  const rows = [
    ['Report title', title],
    ['Generated date', generatedAt],
    ['Requested by', requestedBy],
    ['Filters used', Object.entries(filters).map(([key, value]) => `${key}=${value}`).join('; ') || 'none'],
    [],
    ['Line', 'Content'],
    ...content.split('\n').filter(Boolean).map((line, index) => [String(index + 1), line]),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function csvCell(value?: string) {
  const text = value || ''
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'ai-command-export'
}

function sanitizeText(value: string) {
  return value.replace(/\u0000/g, '').slice(0, 20000)
}
