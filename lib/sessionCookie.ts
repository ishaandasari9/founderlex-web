import 'server-only'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { isValidSessionId } from './sessionId'

export { isValidSessionId } from './sessionId'

export const SESSION_COOKIE = 'fl_session'
const MAX_AGE = 60 * 60 * 24 * 180 // 180 days

// The session id is a bearer token: whoever presents it reads that session's
// stored data. Ids are minted with randomUUID(), so a legitimate cookie is
// always a well-formed UUID. Any caller-supplied cookie that fails
// isValidSessionId (a probe, a truncated value, an injection attempt) is
// ignored rather than used as a lookup key, and a fresh id is minted instead —
// see lib/sessionId.ts. This does not turn anonymous sessions into
// authenticated ones, but it removes a class of malformed/guessed keys.

// Returns the existing session id, or creates + sets a new one.
export async function getOrCreateSessionId(): Promise<{ id: string; isNew: boolean }> {
  const store = await cookies()
  const existing = store.get(SESSION_COOKIE)?.value
  if (isValidSessionId(existing)) return { id: existing, isNew: false }

  const id = randomUUID()
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })
  return { id, isNew: true }
}

export async function readSessionId(): Promise<string | null> {
  const store = await cookies()
  const value = store.get(SESSION_COOKIE)?.value
  return isValidSessionId(value) ? value : null
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}
