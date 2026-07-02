// Kept in its own module (no other imports) so it can be unit tested without
// pulling in lib/supabase.ts, which constructs a client at import time.

// Trust boundary: this app is deployed on Vercel. Per Vercel's own docs,
// Vercel overwrites x-forwarded-for itself and does not forward
// client-supplied IPs through it — the platform discards whatever value the
// client sent and sets this header to the real connecting IP. Vercel also
// sets x-vercel-forwarded-for to the same value, documented as the more
// reliable of the two if an additional proxy sits in front of Vercel's own
// edge network (a client-facing intermediate proxy could still rewrite the
// generic x-forwarded-for before it reaches Vercel, but x-vercel-forwarded-for
// is Vercel's own header). Sources:
//   https://vercel.com/docs/headers/request-headers
//   https://vercel.com/kb/guide/how-to-setup-verified-proxy
//
// x-real-ip is NOT documented as a header Vercel sets, overwrites, or
// otherwise guarantees — an earlier version of this function preferred it,
// which meant an attacker's own forged x-real-ip header could have passed
// through unmodified and won out over the actually-trustworthy
// x-forwarded-for value. It is no longer used here.
export function getClientIp(req: Request): string {
  const trusted = req.headers.get('x-vercel-forwarded-for') ?? req.headers.get('x-forwarded-for')
  if (trusted) {
    const hops = trusted.split(',').map(h => h.trim()).filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }

  return 'unknown'
}
