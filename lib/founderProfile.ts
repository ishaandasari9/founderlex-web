export type BusinessType = 'product' | 'consulting' | 'nonprofit'

const BUSINESS_TYPES: BusinessType[] = ['product', 'consulting', 'nonprofit']

export interface Founder {
  name: string
  equity_pct: number
  role: string
  commitment: string
}

export interface FounderProfile {
  company_name: string | null
  product_description: string
  business_type: BusinessType | null
  founders: Founder[]
  registered: boolean | null
  structure: string | null
  state: string | null
  handles_user_data: boolean | null
  has_ip: boolean | null
  taking_money_from: string | null
  recommended_documents: string[]
  confirmed_documents: string[]
}

export function emptyProfile(): FounderProfile {
  return {
    company_name: null,
    product_description: '',
    business_type: null,
    founders: [],
    registered: null,
    structure: null,
    state: null,
    handles_user_data: null,
    has_ip: null,
    taking_money_from: null,
    recommended_documents: [],
    confirmed_documents: [],
  }
}

const EQUITY_TOLERANCE = 0.5

export function validateProfile(profile: FounderProfile): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  profile.founders.forEach((founder, i) => {
    if (!founder.name || !founder.name.trim()) {
      errors.push(`Founder ${i + 1} is missing a name`)
    }
  })

  if (profile.founders.length > 0) {
    const sum = profile.founders.reduce((total, f) => total + (f.equity_pct || 0), 0)
    if (Math.abs(sum - 100) > EQUITY_TOLERANCE) {
      const breakdown = profile.founders.map((f) => f.equity_pct).join(' + ')
      errors.push(`Founder equity adds up to ${round(sum)}% (${breakdown}), not 100%`)
    }
  }

  if (profile.business_type !== null && !BUSINESS_TYPES.includes(profile.business_type)) {
    errors.push(`business_type must be one of ${BUSINESS_TYPES.join(', ')}`)
  }

  return { valid: errors.length === 0, errors }
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}

export function describeProfile(
  profile: FounderProfile,
  validation: { valid: boolean; errors: string[] },
): string {
  const facts: string[] = []

  if (profile.company_name) facts.push(`Company name: ${profile.company_name}`)
  if (profile.product_description) facts.push(`What they're building: ${profile.product_description}`)
  if (profile.business_type) facts.push(`Business type: ${profile.business_type}`)
  if (profile.founders.length > 0) {
    const breakdown = profile.founders
      .map((f) => `${f.name || 'unnamed founder'} (${f.equity_pct}%${f.role ? `, ${f.role}` : ''})`)
      .join(', ')
    facts.push(`Founders: ${breakdown}`)
  }
  if (profile.registered !== null) facts.push(`Registered: ${profile.registered ? 'yes' : 'not yet'}`)
  if (profile.structure) facts.push(`Structure: ${profile.structure}`)
  if (profile.state) facts.push(`State: ${profile.state}`)
  if (profile.handles_user_data !== null) facts.push(`Handles user data/payments: ${profile.handles_user_data ? 'yes' : 'no'}`)
  if (profile.has_ip !== null) facts.push(`Has IP to protect: ${profile.has_ip ? 'yes' : 'no'}`)
  if (profile.taking_money_from) facts.push(`Taking money from: ${profile.taking_money_from}`)

  if (facts.length === 0) return ''

  const parts = [
    `Known facts about this founder from earlier in the conversation. Do NOT ask about these again, only ask about what's still missing:\n- ${facts.join('\n- ')}`,
  ]

  if (!validation.valid) {
    parts.push(
      `Important: flag this to the founder plainly before moving forward, do not just accept or restate the numbers as given:\n- ${validation.errors.join('\n- ')}`,
    )
  }

  return parts.join('\n\n')
}
