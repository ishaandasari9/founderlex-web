import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { emptyProfile, type FounderProfile } from '@/lib/founderProfile'
import { generateFounderPack, resolveRecommendedTemplates } from '@/lib/founderPack'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { requireJsonContentType, readBodyWithLimit } from '@/lib/requestGuard'

// B2 one-click Founder Pack. Lower cap than /api/generate's single-document
// limit — one request here triggers a full loop over the recommended
// documents (each one already its own docx+pdf build), so it's the
// heavier operation per call.
const FOUNDER_PACK_RATE_LIMIT = 5
const FOUNDER_PACK_RATE_WINDOW_SECONDS = 60
const MAX_BODY_BYTES = 200_000

async function enforceRateLimit(req: Request): Promise<NextResponse | null> {
  const ip = getClientIp(req)
  const allowed = await checkRateLimit(`founder-pack:${ip}`, FOUNDER_PACK_RATE_LIMIT, FOUNDER_PACK_RATE_WINDOW_SECONDS)
  if (allowed) return null
  return NextResponse.json(
    { error: "You're generating founder packs a little too quickly. Please wait a moment and try again." },
    { status: 429 },
  )
}

export async function POST(req: Request) {
  try {
    const contentTypeError = requireJsonContentType(req)
    if (contentTypeError) {
      return NextResponse.json({ error: contentTypeError }, { status: 415 })
    }

    const limited = await enforceRateLimit(req)
    if (limited) return limited

    const bodyResult = await readBodyWithLimit(req, MAX_BODY_BYTES)
    if (bodyResult.error) {
      return NextResponse.json({ error: bodyResult.error }, { status: 413 })
    }

    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(bodyResult.text)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const { profile } = parsedBody as { profile?: FounderProfile | null }
    const effectiveProfile = profile ?? emptyProfile()

    // A 400 (bad request), not a 500 — calling this before FounderLex has
    // recommended anything is a client-side usage issue, not a server fault.
    if (resolveRecommendedTemplates(effectiveProfile).length === 0) {
      return NextResponse.json(
        { error: 'No recommended documents to include in a Founder Pack yet — chat with FounderLex to get document recommendations first.' },
        { status: 400 },
      )
    }

    const pack = await generateFounderPack(effectiveProfile)

    // Bundle as one zip: each document's docx + pdf, plus the cover memo as
    // a plain-text file — one download, not a pile of separate files.
    const zip = new JSZip()
    for (const doc of pack.docs) {
      zip.file(doc.docx_name, doc.docx_b64, { base64: true })
      zip.file(doc.pdf_name, doc.pdf_b64, { base64: true })
    }
    zip.file('Cover Memo.txt', pack.coverMemo)

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    const companySlug = (effectiveProfile.company_name || 'founder-pack').replace(/\s+/g, '-').toLowerCase()
    const zipName = `${companySlug}-founder-pack.zip`

    return NextResponse.json({
      zip_b64: zipBuffer.toString('base64'),
      zip_name: zipName,
      cover_memo: pack.coverMemo,
      docs: pack.docs.map((d) => ({ template_name: d.template_name, label: d.label, filled: d.filled })),
      validation: pack.profileValidation,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[founder-pack]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
