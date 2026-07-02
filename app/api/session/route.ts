import { NextResponse } from 'next/server'
import { getOrCreateSessionId, readSessionId, clearSessionCookie } from '@/lib/sessionCookie'
import { getSession, saveSession, deleteSession } from '@/lib/supabase'
import type { FounderProfile } from '@/lib/founderProfile'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { validateSessionPayload } from '@/lib/sessionValidation'
import { requireJsonContentType } from '@/lib/requestGuard'

const SESSION_RATE_LIMIT = 30
const SESSION_RATE_WINDOW_SECONDS = 60

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return String(err)
}

async function enforceRateLimit(req: Request): Promise<NextResponse | null> {
  const ip = getClientIp(req)
  const allowed = await checkRateLimit(`session:${ip}`, SESSION_RATE_LIMIT, SESSION_RATE_WINDOW_SECONDS)
  if (allowed) return null
  return NextResponse.json(
    { error: "You're saving your session a little too quickly. Please wait a moment and try again." },
    { status: 429 },
  )
}

export async function GET(req: Request) {
  try {
    const limited = await enforceRateLimit(req)
    if (limited) return limited

    const { id } = await getOrCreateSessionId()
    const stored = await getSession(id)
    return NextResponse.json({ messages: stored?.messages ?? [], profile: stored?.profile ?? null })
  } catch (err: unknown) {
    const msg = errorMessage(err)
    console.error('[session:get]', msg)
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

    const { messages, profile } = await req.json() as {
      messages: unknown[]
      profile?: FounderProfile | null
    }

    const validationError = validateSessionPayload(messages, profile)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { id } = await getOrCreateSessionId()
    await saveSession(id, messages ?? [], profile ?? null)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = errorMessage(err)
    console.error('[session:post]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const limited = await enforceRateLimit(req)
    if (limited) return limited

    const id = await readSessionId()
    if (id) await deleteSession(id)
    await clearSessionCookie()
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = errorMessage(err)
    console.error('[session:delete]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
