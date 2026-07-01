import { NextResponse } from 'next/server'
import { getOrCreateSessionId, readSessionId, clearSessionCookie } from '@/lib/sessionCookie'
import { getSession, saveSession, deleteSession } from '@/lib/supabase'
import type { FounderProfile } from '@/lib/founderProfile'

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return String(err)
}

export async function GET() {
  try {
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
    const { messages, profile } = await req.json() as {
      messages: unknown[]
      profile?: FounderProfile | null
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

export async function DELETE() {
  try {
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
