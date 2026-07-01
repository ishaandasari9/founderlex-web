import type { FounderProfile } from './founderProfile'

function computeEqualEquity(founders: FounderProfile['founders']): boolean {
  if (founders.length < 2) return false
  const [first, ...rest] = founders
  return rest.every((f) => Math.abs(f.equity_pct - first.equity_pct) < 0.5)
}

export function buildTemplateVars(profile: FounderProfile): Record<string, unknown> {
  const effectiveDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return {
    company_name: profile.company_name ?? '',
    organization_name: profile.company_name ?? '',
    business_description: profile.product_description,
    state_of_formation: profile.state ?? '',
    state_of_incorporation: profile.state ?? '',
    governing_state: profile.state ?? '',
    business_structure: profile.structure ?? '',
    effective_date: effectiveDate,
    founders: profile.founders,
    equal_equity: computeEqualEquity(profile.founders),
    party_1_name: profile.company_name ?? '',
  }
}
