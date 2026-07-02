import { NextResponse } from 'next/server'
import { searchNameOnWeb } from '@/lib/nameWebSearch'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { requireJsonContentType, readBodyWithLimit } from '@/lib/requestGuard'

// Each request can trigger up to WEB_SEARCH_MAX_USES real web searches
// ($10/1,000 searches, plus token costs) — keep this tighter than a plain
// chat/explain call.
const NAME_SEARCH_RATE_LIMIT = 8
const NAME_SEARCH_RATE_WINDOW_SECONDS = 60
const MAX_NAME_LENGTH = 200
const MAX_NAME_SEARCH_BODY_BYTES = 2_000

export async function POST(req: Request) {
  try {
    const contentTypeError = requireJsonContentType(req)
    if (contentTypeError) {
      return NextResponse.json({ error: contentTypeError }, { status: 415 })
    }

    const ip = getClientIp(req)
    const allowed = await checkRateLimit(`name-web-search:${ip}`, NAME_SEARCH_RATE_LIMIT, NAME_SEARCH_RATE_WINDOW_SECONDS)
    if (!allowed) {
      return NextResponse.json(
        { error: "You're searching a little too quickly. Please wait a moment and try again." },
        { status: 429 },
      )
    }

    const bodyResult = await readBodyWithLimit(req, MAX_NAME_SEARCH_BODY_BYTES)
    if (bodyResult.error) {
      return NextResponse.json({ error: bodyResult.error }, { status: 413 })
    }

    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(bodyResult.text)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const { name } = parsedBody as { name?: unknown }
    const trimmed = typeof name === 'string' ? name.trim() : ''

    if (!trimmed) {
      return NextResponse.json({ error: 'Enter a name to search for.' }, { status: 400 })
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `That name is too long (${trimmed.length.toLocaleString()} characters, limit ${MAX_NAME_LENGTH}).` },
        { status: 400 },
      )
    }

    const result = await searchNameOnWeb(trimmed)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[name-search]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
