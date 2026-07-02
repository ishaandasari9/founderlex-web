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
import { renderTemplate } from './renderTemplate'
import { buildTemplateVars } from './profileToTemplateVars'
import type { FounderProfile } from './founderProfile'

// The single document-generation engine (README-v3 B2 backend note: "reuse
// the single-document generator in a loop over the recommended set — do
// NOT write a second generation path. One engine, many documents."). Split
// out of app/api/generate/route.ts (which now just calls generateDocument)
// so the B2 Founder Pack route can call the exact same function in a loop,
// rather than forking a parallel copy of the render/docx/pdf pipeline.

// Map frontend template keys → actual filenames in lib/templates/
export const TEMPLATE_FILES: Record<string, string> = {
  founders_agreement:              'founders-agreement',
  mutual_nda:                      'nda-mutual',
  unilateral_nda:                  'nda-unilateral',
  advisor_agreement:               'advisor-agreement',
  master_services_agreement:       'master-services-agreement',
  donation_acknowledgment_letter:  'donation-acknowledgment-letter',
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

export interface GeneratedDocumentResult {
  template_name: string
  filename: string
  docx_b64: string
  docx_name: string
  pdf_b64: string
  pdf_name: string
  filled: string
}

export function readTemplateRaw(templateName: string): string {
  const filename = TEMPLATE_FILES[templateName]
  if (!filename) throw new Error(`Unknown template: ${templateName}`)
  const templatePath = join(process.cwd(), 'lib', 'templates', `${filename}.md`)
  return readFileSync(templatePath, 'utf8')
}

// THE single document-generation engine. Used by both app/api/generate's
// single-document route and the B2 Founder Pack route (app/api/founder-pack)
// looping over the recommended set — one engine, many documents, never a
// second generation path.
export async function generateDocument(templateName: string, profile: FounderProfile): Promise<GeneratedDocumentResult> {
  const filename = TEMPLATE_FILES[templateName]
  if (!filename) throw new Error(`Unknown template: ${templateName}`)

  const raw = readTemplateRaw(templateName)
  const vars = buildTemplateVars(profile)
  const filled = renderTemplate(raw, vars)

  const title = filename.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const html = await marked.parse(filled)

  const [docxBuf, pdfBuf] = await Promise.all([
    buildDocx(html, title),
    buildPdf(filled, title),
  ])

  const slug = ((vars.company_name as string) || 'document').replace(/\s+/g, '-').toLowerCase()

  return {
    template_name: templateName,
    filename,
    docx_b64: docxBuf.toString('base64'),
    docx_name: `${slug}-${filename}.docx`,
    pdf_b64: pdfBuf.toString('base64'),
    pdf_name: `${slug}-${filename}.pdf`,
    filled,
  }
}
