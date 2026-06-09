import { NextRequest, NextResponse } from 'next/server'
import { requireManagerForApi } from '@/lib/rbac'
import { createAdminClient } from '@/lib/supabase/server'
import { PROCTORING_EVIDENCE_BUCKET } from '@/lib/proctoring-server'
import sharp from 'sharp'
import JSZip from 'jszip'

type Format = 'png' | 'jpg' | 'pdf' | 'docx'

export async function GET(request: NextRequest) {
  const auth = await requireManagerForApi()
  if (auth instanceof NextResponse) return auth

  const { searchParams } = request.nextUrl
  const rawPath = searchParams.get('path') || ''
  const format = (searchParams.get('format') || 'jpg') as Format

  if (!rawPath) return NextResponse.json({ error: 'path is required' }, { status: 400 })
  if (!['png', 'jpg', 'pdf', 'docx'].includes(format)) {
    return NextResponse.json({ error: 'format must be png, jpg, pdf, or docx' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Resolve storage object path (strip bucket prefix if present)
  const objectPath = rawPath.startsWith(`${PROCTORING_EVIDENCE_BUCKET}/`)
    ? rawPath.split('/').slice(1).join('/')
    : rawPath

  // Download from Supabase storage
  const { data: fileData, error } = await admin.storage
    .from(PROCTORING_EVIDENCE_BUCKET)
    .download(objectPath)

  if (error || !fileData) {
    return NextResponse.json({ error: 'Evidence not found in storage' }, { status: 404 })
  }

  const inputBuffer = Buffer.from(await fileData.arrayBuffer())
  const basename = objectPath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'evidence'
  const filename = `${basename}.${format}`

  // ── PNG ───────────────────────────────────────────────────────────────────
  if (format === 'png') {
    const png = await sharp(inputBuffer).png().toBuffer()
    return new NextResponse(png.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // ── JPG ───────────────────────────────────────────────────────────────────
  if (format === 'jpg') {
    const jpg = await sharp(inputBuffer).jpeg({ quality: 92 }).toBuffer()
    return new NextResponse(new Uint8Array(jpg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  if (format === 'pdf') {
    const jpegBuf = await sharp(inputBuffer).jpeg({ quality: 92 }).toBuffer()
    const meta = await sharp(jpegBuf).metadata()
    const W = meta.width || 800
    const H = meta.height || 600
    const pdf = buildMinimalPdf(jpegBuf, W, H)
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // ── DOCX ──────────────────────────────────────────────────────────────────
  if (format === 'docx') {
    const jpegBuf = await sharp(inputBuffer).jpeg({ quality: 92 }).toBuffer()
    const meta = await sharp(jpegBuf).metadata()
    const maxWidthEmu = 5400000
    const W = meta.width || 800
    const H = meta.height || 600
    const ratio = H / W
    const imgWidthEmu = maxWidthEmu
    const imgHeightEmu = Math.round(maxWidthEmu * ratio)

    const zip = new JSZip()
    zip.file('[Content_Types].xml', CONTENT_TYPES_XML)
    zip.folder('_rels')!.file('.rels', RELS_XML)
    const word = zip.folder('word')!
    word.file('document.xml', buildDocumentXml(imgWidthEmu, imgHeightEmu))
    word.folder('_rels')!.file('document.xml.rels', DOCUMENT_RELS_XML)
    word.folder('media')!.file('image1.jpg', jpegBuf)

    const docxBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    return new NextResponse(new Uint8Array(docxBuf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
}

// ── Minimal PDF builder (JPEG only, no external deps) ────────────────────────
function buildMinimalPdf(jpegBytes: Buffer, width: number, height: number): Buffer {
  const imgLen = jpegBytes.length
  const contentStream = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q\n`
  const contentLen = Buffer.byteLength(contentStream)

  const header = '%PDF-1.4\n'
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}]\n   /Resources << /XObject << /Im0 4 0 R >> >>\n   /Contents 5 0 R >>\nendobj\n`
  const obj4header = `4 0 obj\n<< /Type /XObject /Subtype /Image\n   /Width ${width} /Height ${height}\n   /ColorSpace /DeviceRGB /BitsPerComponent 8\n   /Filter /DCTDecode /Length ${imgLen} >>\nstream\n`
  const obj4footer = '\nendstream\nendobj\n'
  const obj5 = `5 0 obj\n<< /Length ${contentLen} >>\nstream\n${contentStream}endstream\nendobj\n`

  // Build buffer pieces
  const parts: Buffer[] = [
    Buffer.from(header),
    Buffer.from(obj1),
    Buffer.from(obj2),
    Buffer.from(obj3),
    Buffer.from(obj4header),
    jpegBytes,
    Buffer.from(obj4footer),
    Buffer.from(obj5),
  ]

  // Calculate byte offsets for xref
  const offsets: number[] = []
  let pos = 0
  for (const part of parts) {
    if (parts.indexOf(part) >= 1 && parts.indexOf(part) <= 5) offsets.push(pos)
    pos += part.length
  }

  // Re-build with correct offsets
  const body = Buffer.concat(parts)
  let offset = 0
  const xrefOffsets: number[] = []
  const bodyStr = body.toString('binary')

  // Simple offset calculation
  const o1 = header.length
  const o2 = o1 + obj1.length
  const o3 = o2 + obj2.length
  const o4 = o3 + obj3.length
  const o5 = o4 + obj4header.length + imgLen + obj4footer.length
  offset = o5 + obj5.length

  const xref = [
    'xref\n',
    '0 6\n',
    '0000000000 65535 f \n',
    `${String(o1).padStart(10, '0')} 00000 n \n`,
    `${String(o2).padStart(10, '0')} 00000 n \n`,
    `${String(o3).padStart(10, '0')} 00000 n \n`,
    `${String(o4).padStart(10, '0')} 00000 n \n`,
    `${String(o5).padStart(10, '0')} 00000 n \n`,
  ].join('')

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`

  return Buffer.concat([body, Buffer.from(xref + trailer)])
}

// ── Minimal DOCX XML templates ────────────────────────────────────────────────
const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`

const DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
    Target="media/image1.jpg"/>
</Relationships>`

function buildDocumentXml(widthEmu: number, heightEmu: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
            <wp:docPr id="1" name="Evidence Frame"/>
            <a:graphic>
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic>
                  <pic:nvPicPr>
                    <pic:cNvPr id="1" name="image1.jpg"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="rId1"/>
                    <a:stretch><a:fillRect/></a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
  </w:body>
</w:document>`
}
