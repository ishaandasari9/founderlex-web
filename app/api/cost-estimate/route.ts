import { NextResponse } from 'next/server'
import { selectCostItems, type CostSituation } from '@/lib/costEstimator'
import type { BusinessType } from '@/lib/founderProfile'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { requireJsonContentType } from '@/lib/requestGuard'

const COST_RATE_LIMIT = 20
const COST_RATE_WINDOW_SECONDS = 60

const VALID_BUSINESS_TYPES: BusinessType[] = ['product', 'consulting', 'nonprofit']
const VALID_SITUATIONS: CostSituation[] = [
  'has_equity',
  'delaware',
  'accepting_donations',
  'trademark',
  'hiring',
]

export async function POST(req: Request) {
  try {
    const contentTypeError = requireJsonContentType(req)
    if (contentTypeError) {
      return NextResponse.json({ error: contentTypeError }, { status: 415 })
    }

    const ip = getClientIp(req)
    const allowed = await checkRateLimit(
      `cost-estimate:${ip}`,
      COST_RATE_LIMIT,
      COST_RATE_WINDOW_SECONDS,
    )
    if (!allowed) {
      return NextResponse.json(
        { error: "You're requesting this a little too quickly. Please wait a moment and try again." },
        { status: 429 },
      )
    }

    const body = (await req.json()) as unknown

    // Reject bodies that aren't a plain JSON object (null, arrays, primitives)
    // with a 400 rather than letting a property access throw a 500 downstream.
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 })
    }

    const { businessType: rawBusinessType, situations: rawSituations } = body as {
      businessType?: unknown
      situations?: unknown
    }

    // Validate strictly: an unrecognized business type becomes "unknown" (null),
    // and only allowlisted situation tags survive, so a malformed request can't
    // smuggle in unexpected filtering behavior.
    const businessType =
      typeof rawBusinessType === 'string' &&
      VALID_BUSINESS_TYPES.includes(rawBusinessType as BusinessType)
        ? (rawBusinessType as BusinessType)
        : null

    const situations = Array.isArray(rawSituations)
      ? (rawSituations.filter(
          (s): s is CostSituation =>
            typeof s === 'string' && VALID_SITUATIONS.includes(s as CostSituation),
        ) as CostSituation[])
      : []

    const result = selectCostItems(businessType, situations)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cost-estimate]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
