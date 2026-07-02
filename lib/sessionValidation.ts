// Kept separate from lib/supabase.ts (which constructs a Supabase client at
// import time and can't be safely imported in a plain test runner) so this
// pure validation logic stays unit-testable.

export const MAX_SESSION_PAYLOAD_CHARS = 100_000

// /api/session had no size limit at all on what gets written per save,
// unlike /api/chat and /api/explain — an attacker could POST arbitrarily
// large messages/profile blobs, with no rate limit either (see below),
// driving up Supabase storage.
export function validateSessionPayload(messages: unknown, profile: unknown): string | null {
  const size = JSON.stringify({ messages: messages ?? [], profile: profile ?? null }).length
  if (size > MAX_SESSION_PAYLOAD_CHARS) {
    return `Session data is too large to save (${size.toLocaleString()} characters, limit ${MAX_SESSION_PAYLOAD_CHARS.toLocaleString()}).`
  }
  return null
}
