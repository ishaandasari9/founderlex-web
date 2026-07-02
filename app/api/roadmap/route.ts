import { NextResponse } from 'next/server'
import { getOrCreateSessionId } from '@/lib/sessionCookie'
import { getSession } from '@/lib/supabase'
import { buildRoadmap } from '@/lib/foundingRoadmap'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

const ROADMAP_RATE_LIMIT = 30
const ROADMAP_RATE_WINDOW_SECONDS = 60

// Derives the founder's roadmap from the profile already persisted for their
// session — no request body, no new state. Mirrors the session GET route's
// shape (cookie -> stored session -> derive), so the roadmap always reflects
// whatever the founder has told the tool so far.
export async function GET(req: Request) {
  try {
    const ip = getClientIp(req)
    const allowed = await checkRateLimit(
      `roadmap:${ip}`,
      ROADMAP_RATE_LIMIT,
      ROADMAP_RATE_WINDOW_SECONDS,
    )
    if (!allowed) {
      return NextResponse.json(
        { error: "You're refreshing this a little too quickly. Please wait a moment and try again." },
        { status: 429 },
      )
    }

    const { id } = await getOrCreateSessionId()
    const stored = await getSession(id)
    const roadmap = buildRoadmap(stored?.profile ?? null)
    return NextResponse.json({ roadmap })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[roadmap]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
