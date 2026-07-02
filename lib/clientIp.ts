// Kept in its own module (no other imports) so it can be unit tested without
// pulling in lib/supabase.ts, which constructs a client at import time.

// Trust boundary: this assumes the app sits behind exactly one reverse proxy
// (e.g. Vercel's edge network) that appends the real client IP as the last
// hop of X-Forwarded-For. Every earlier entry in that header is supplied by
// the client and can be forged, so previously reading index [0] returned an
// attacker-chosen value — this was a rate-limit bypass, since IP is the only
// identifier checkRateLimit uses. x-real-ip, where present, is a single
// value set directly by the proxy and preferred when available.
export function getClientIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const hops = xff.split(',').map(h => h.trim()).filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }

  return 'unknown'
}
