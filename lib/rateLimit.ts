import 'server-only'
import { supabaseAdmin } from './supabase'

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return String(err)
}

// Fixed-window rate limiting on top of the existing Supabase project — no new
// service. Each call buckets "now" into a window and atomically increments the
// counter for that (identifier, window) pair via the increment_rate_limit RPC
// (defined in supabase/migrations/0002_rate_limits.sql), which is race-safe
// under concurrent requests because it's a single INSERT ... ON CONFLICT.
export async function checkRateLimit(identifier: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const windowMs = windowSeconds * 1000
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString()

    const { data, error } = await supabaseAdmin.rpc('increment_rate_limit', {
      p_identifier: identifier,
      p_window_start: windowStart,
    })

    if (error) throw error
    const count = Number(data)
    return count <= limit
  } catch (err: unknown) {
    // A limiter bug must never take down the app — log and let the request through.
    console.error('[rateLimit] check failed, allowing request through:', errorMessage(err))
    return true
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return 'unknown'
}
