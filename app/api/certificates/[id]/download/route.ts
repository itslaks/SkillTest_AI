import { NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { getCertificateDisplay, getCertificateForViewer } from '@/lib/certificate-access'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getCertificateForViewer(id)

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status })
  }

  const { certificate } = result
  const { accent, employeeName, courseName, topic, issueDate } = getCertificateDisplay(certificate)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()
  const rgb = hexToRgb(accent)

  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, width, height, 'F')
  pdf.setDrawColor(88, 88, 88)
  pdf.setLineWidth(0.7)
  pdf.roundedRect(8, 8, width - 16, height - 16, 4, 4)

  drawDecorations(pdf, width, height, rgb)

  pdf.setTextColor(0, 0, 0)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(34)
  pdf.text('Certificate', width / 2, 42, { align: 'center' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(13)
  pdf.text('OF ACHIEVEMENT', width / 2, 56, { align: 'center', charSpace: 3 })

  pdf.setDrawColor(0, 0, 0)
  pdf.line(width / 2 - 35, 72, width / 2 - 7, 72)
  pdf.line(width / 2 + 7, 72, width / 2 + 35, 72)
  pdf.setFillColor(rgb.r, rgb.g, rgb.b)
  pdf.rect(width / 2 - 4, 68, 8, 8, 'FD')

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(12)
  pdf.text('This is to certify that', width / 2, 96, { align: 'center', charSpace: 1.2 })

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(28)
  pdf.setTextColor(rgb.r, rgb.g, rgb.b)
  pdf.text(employeeName, width / 2, 118, { align: 'center' })
  pdf.setDrawColor(120, 120, 120)
  pdf.line(width / 2 - 42, 123, width / 2 + 42, 123)

  pdf.setTextColor(0, 0, 0)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(12)
  const message = certificate.message || `has been awarded this certificate in recognition of outstanding performance in the quiz on ${topic}`
  const wrapped = pdf.splitTextToSize(message, 178)
  pdf.text(wrapped, width / 2, 138, { align: 'center' })

  pdf.setFont('helvetica', 'bold')
  pdf.text('Presented by Hexaware Technologies', width / 2, 158, { align: 'center' })

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(80, 80, 80)
  pdf.text(`Course: ${courseName}`, 18, height - 22)
  pdf.text(`Score: ${certificate.score}%`, 18, height - 15)
  pdf.text(`Issued: ${issueDate}`, width - 18, height - 22, { align: 'right' })
  pdf.text(`Certificate ID: ${certificate.id}`, width - 18, height - 15, { align: 'right' })

  const arrayBuffer = pdf.output('arraybuffer')
  const filename = `${slugify(employeeName)}-${slugify(courseName)}-certificate.pdf`

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

function drawDecorations(pdf: jsPDF, width: number, height: number, rgb: { r: number; g: number; b: number }) {
  pdf.setDrawColor(rgb.r, rgb.g, rgb.b)
  pdf.setFillColor(139, 160, 239)
  pdf.triangle(10, height - 50, 48, height - 24, 10, height - 8, 'F')
  pdf.setFillColor(rgb.r, rgb.g, rgb.b)
  pdf.triangle(width - 10, height - 50, width - 48, height - 24, width - 10, height - 8, 'F')

  pdf.setLineWidth(2)
  for (const [x, y, r] of [
    [28, 30, 5],
    [52, 18, 2],
    [width - 28, 30, 5],
    [width - 52, 18, 2],
  ] as Array<[number, number, number]>) {
    pdf.circle(x, y, r, r > 3 ? 'S' : 'F')
  }

  pdf.setDrawColor(168, 187, 255)
  pdf.line(24, 52, 34, 45)
  pdf.line(width - 24, 52, width - 34, 45)
}

function hexToRgb(hex: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '6f5ab8'
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'certificate'
}
