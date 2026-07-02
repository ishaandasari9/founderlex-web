import { NextResponse } from 'next/server'
import { compareDocuments } from '@/lib/compareDocuments'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { requireJsonContentType } from '@/lib/requestGuard'

const COMPARE_RATE_LIMIT = 8
const COMPARE_RATE_WINDOW_SECONDS = 60
const MAX_INPUT_CHARS = 20000

export async function POST(req: Request) {
  try {
    const contentTypeError = requireJsonContentType(req)
    if (contentTypeError) {
      return NextResponse.json({ error: contentTypeError }, { status: 415 })
    }

    const ip = getClientIp(req)
    const allowed = await checkRateLimit(
      `compare:${ip}`,
      COMPARE_RATE_LIMIT,
      COMPARE_RATE_WINDOW_SECONDS,
    )
    if (!allowed) {
      return NextResponse.json(
        { error: "You're submitting comparisons a little too quickly. Please wait a moment and try again." },
        { status: 429 },
      )
    }

    const body = (await req.json()) as unknown

    // Reject bodies that aren't a plain JSON object (null, arrays, primitives)
    // with a 400 rather than letting a property access throw a 500 downstream.
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 })
    }

    const { originalText, revisedText } = body as {
      originalText?: unknown
      revisedText?: unknown
    }

    const original = (typeof originalText === 'string' ? originalText : '').trim()
    const revised = (typeof revisedText === 'string' ? revisedText : '').trim()

    if (!original || !revised) {
      return NextResponse.json(
        { error: 'Paste both versions — an original and a revised version — to compare them.' },
        { status: 400 },
      )
    }

    for (const [label, value] of [
      ['original', original],
      ['revised', revised],
    ] as const) {
      if (value.length > MAX_INPUT_CHARS) {
        return NextResponse.json(
          {
            error: `The ${label} version is too long to compare at once (${value.length.toLocaleString()} characters, limit ${MAX_INPUT_CHARS.toLocaleString()}). Try comparing one agreement or a few clauses at a time.`,
          },
          { status: 400 },
        )
      }
    }

    const comparison = await compareDocuments(original, revised)
    return NextResponse.json({ comparison })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[compare]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
