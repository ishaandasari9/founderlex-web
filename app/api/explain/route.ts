import { NextResponse } from 'next/server'
import { explainForm } from '@/lib/explainForm'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const EXPLAIN_RATE_LIMIT = 8
const EXPLAIN_RATE_WINDOW_SECONDS = 60
const MAX_INPUT_CHARS = 20000

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const allowed = await checkRateLimit(`explain:${ip}`, EXPLAIN_RATE_LIMIT, EXPLAIN_RATE_WINDOW_SECONDS)
    if (!allowed) {
      return NextResponse.json(
        { error: "You're submitting forms a little too quickly. Please wait a moment and try again." },
        { status: 429 },
      )
    }

    const { text } = await req.json() as { text?: string }
    const trimmed = (text ?? '').trim()

    if (!trimmed) {
      return NextResponse.json({ error: 'Paste the text of a form or contract to explain.' }, { status: 400 })
    }
    if (trimmed.length > MAX_INPUT_CHARS) {
      return NextResponse.json(
        {
          error: `That's too long to explain at once (${trimmed.length.toLocaleString()} characters, limit ${MAX_INPUT_CHARS.toLocaleString()}). Try pasting one agreement or a few clauses at a time.`,
        },
        { status: 400 },
      )
    }

    const explanation = await explainForm(trimmed)
    return NextResponse.json({ explanation })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[explain]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
