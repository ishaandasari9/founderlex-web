import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { marked } from 'marked'
type HTMLtoDOCXFn = (html: string, header: undefined, opts: object) => Promise<Buffer>
async function getHTMLtoDOCX(): Promise<HTMLtoDOCXFn> {
  // CJS default export — handle both direct and .default wrapping
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('html-to-docx')
  return (typeof mod === 'function' ? mod : mod.default) as HTMLtoDOCXFn
}
import PDFDocument from 'pdfkit'

// Map frontend template keys → actual filenames in lib/templates/
const TEMPLATE_FILES: Record<string, string> = {
  founders_agreement:              'founders-agreement',
  mutual_nda:                      'nda-mutual',
  contractor_agreement:            'independent-contractor',
  independent_contractor_consulting:'independent-contractor',
  terms_of_service:                'terms-of-service',
  privacy_policy:                  'privacy-policy',
  sow_template:                    'statement-of-work',
  consulting_agreement:            'consulting-ip-addendum',
  nonprofit_articles:              'articles-of-incorporation',
  nonprofit_bylaws:                'nonprofit-bylaws',
  nonprofit_conflict_of_interest:  'conflict-of-interest-policy',
}

function fillTemplate(template: string, details: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = details[key]
    if (val && val.trim()) return val
    return `[TO BE COMPLETED: ${key.replace(/_/g, ' ')}]`
  })
}

// Strip inline markdown markers for plain-text PDF rendering
function stripInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
}

async function buildDocx(html: string, title: string): Promise<Buffer> {
  const HTMLtoDOCX = await getHTMLtoDOCX()
  const header = `<p style="font-size:9pt;color:#888;border-bottom:1px solid #ccc;padding-bottom:4px;">
    FounderLex — educational draft only. Have a licensed attorney review before signing or filing.
  </p>`
  const result = await HTMLtoDOCX(header + html, undefined, {
    title,
    creator: 'FounderLex',
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
  })
  return result as Buffer
}

function buildPdf(filledText: string, title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 72, size: 'LETTER' })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const DISCLAIMER =
      'FounderLex — educational draft only. Have a licensed attorney review before signing or filing.'

    // Disclaimer banner
    doc.fontSize(8).fillColor('#888888').text(DISCLAIMER, { align: 'center' })
    doc.moveDown(0.5)
    doc.moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y).strokeColor('#cccccc').stroke()
    doc.moveDown(1)

    const tokens = marked.lexer(filledText)

    for (const token of tokens) {
      if (token.type === 'heading') {
        const sz = token.depth === 1 ? 18 : token.depth === 2 ? 14 : 12
        doc.fontSize(sz).fillColor('#1a1a1a').font('Helvetica-Bold')
           .text(stripInline(token.text), { paragraphGap: 6 })
        doc.moveDown(0.4)
        doc.font('Helvetica')

      } else if (token.type === 'paragraph') {
        doc.fontSize(10.5).fillColor('#2A2420').font('Helvetica')
           .text(stripInline(token.text), { lineGap: 3, paragraphGap: 8 })

      } else if (token.type === 'blockquote') {
        // Render explanatory notes as small gray indented text
        const inner = token.tokens
          ? token.tokens.map((t: any) => (t.type === 'paragraph' ? stripInline(t.text) : '')).join(' ')
          : ''
        if (inner.trim()) {
          doc.fontSize(8.5).fillColor('#888888').font('Helvetica-Oblique')
             .text(inner.trim(), { indent: 20, lineGap: 2, paragraphGap: 8 })
          doc.font('Helvetica')
        }

      } else if (token.type === 'list') {
        for (const item of (token as any).items) {
          const txt = item.tokens
            ? item.tokens.map((t: any) => (t.type === 'text' ? stripInline(t.text) : '')).join('')
            : stripInline(item.text || '')
          doc.fontSize(10.5).fillColor('#2A2420').font('Helvetica')
             .text(`•  ${txt}`, { indent: 16, lineGap: 3, paragraphGap: 4 })
        }
        doc.moveDown(0.4)

      } else if (token.type === 'hr') {
        doc.moveDown(0.5)
        doc.moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y).strokeColor('#dddddd').stroke()
        doc.moveDown(0.5)

      } else if (token.type === 'space') {
        doc.moveDown(0.5)
      }
    }

    doc.end()
  })
}

export async function POST(req: Request) {
  try {
    const { template_name, founder_details = {} } = await req.json()

    const filename = TEMPLATE_FILES[template_name]
    if (!filename) {
      return NextResponse.json({ error: `Unknown template: ${template_name}` }, { status: 400 })
    }

    const templatePath = join(process.cwd(), 'lib', 'templates', `${filename}.md`)
    const raw = readFileSync(templatePath, 'utf8')
    const filled = fillTemplate(raw, founder_details)

    const title = filename.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const html = await marked.parse(filled)

    const [docxBuf, pdfBuf] = await Promise.all([
      buildDocx(html, title),
      buildPdf(filled, title),
    ])

    const slug = (founder_details.company_name || 'document').replace(/\s+/g, '-').toLowerCase()

    return NextResponse.json({
      docx_b64:  docxBuf.toString('base64'),
      docx_name: `${slug}-${filename}.docx`,
      pdf_b64:   pdfBuf.toString('base64'),
      pdf_name:  `${slug}-${filename}.pdf`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[generate]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
