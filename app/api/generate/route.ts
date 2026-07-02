import { NextResponse } from 'next/server'
import { emptyProfile, type FounderProfile } from '@/lib/founderProfile'
import { getRelevantFields } from '@/lib/confirmationFields'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { requireJsonContentType } from '@/lib/requestGuard'
import { TEMPLATE_FILES, readTemplateRaw, generateDocument } from '@/lib/generateDocument'

const GENERATE_RATE_LIMIT = 10
const GENERATE_RATE_WINDOW_SECONDS = 60

async function enforceRateLimit(req: Request): Promise<NextResponse | null> {
  const ip = getClientIp(req)
  const allowed = await checkRateLimit(`generate:${ip}`, GENERATE_RATE_LIMIT, GENERATE_RATE_WINDOW_SECONDS)
  if (allowed) return null
  return NextResponse.json(
    { error: "You're generating documents a little too quickly. Please wait a moment and try again." },
    { status: 429 },
  )
}

export async function GET(req: Request) {
  try {
    const limited = await enforceRateLimit(req)
    if (limited) return limited

    const templateName = new URL(req.url).searchParams.get('template_name') ?? ''
    if (!TEMPLATE_FILES[templateName]) {
      return NextResponse.json({ error: `Unknown template: ${templateName}` }, { status: 400 })
    }

    const raw = readTemplateRaw(templateName)
    return NextResponse.json({ fields: getRelevantFields(raw) })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[generate:fields]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const contentTypeError = requireJsonContentType(req)
    if (contentTypeError) {
      return NextResponse.json({ error: contentTypeError }, { status: 415 })
    }

    const limited = await enforceRateLimit(req)
    if (limited) return limited

    const { template_name, profile } = await req.json() as {
      template_name: string
      profile?: FounderProfile | null
    }

    if (!TEMPLATE_FILES[template_name]) {
      return NextResponse.json({ error: `Unknown template: ${template_name}` }, { status: 400 })
    }

    const result = await generateDocument(template_name, profile ?? emptyProfile())

    return NextResponse.json({
      docx_b64:  result.docx_b64,
      docx_name: result.docx_name,
      pdf_b64:   result.pdf_b64,
      pdf_name:  result.pdf_name,
      filled:    result.filled,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[generate]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
