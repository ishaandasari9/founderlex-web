import 'server-only'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'

export const SESSION_COOKIE = 'fl_session'
const MAX_AGE = 60 * 60 * 24 * 180 // 180 days

// Returns the existing session id, or creates + sets a new one.
export async function getOrCreateSessionId(): Promise<{ id: string; isNew: boolean }> {
  const store = await cookies()
  const existing = store.get(SESSION_COOKIE)?.value
  if (existing) return { id: existing, isNew: false }

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
  return store.get(SESSION_COOKIE)?.value ?? null
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}
