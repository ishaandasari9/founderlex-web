// Pure session-id validation, split out from lib/sessionCookie.ts (which pulls
// in `server-only` and next/headers and therefore can't be imported by a plain
// test runner). Keeping the validator here lets it be unit-tested directly.
//
// The session id is a bearer token: whoever presents it reads that session's
// stored data. Ids are minted with randomUUID(), so a legitimate cookie is
// always a v4-shaped UUID. Validating the format on the way in means a
// caller-supplied cookie that isn't a well-formed UUID — a probe, a truncated
// value, an injection attempt — is ignored rather than used as a storage
// lookup key.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidSessionId(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}
