export type BusinessType = 'product' | 'consulting' | 'nonprofit'

const BUSINESS_TYPES: BusinessType[] = ['product', 'consulting', 'nonprofit']

export interface Founder {
  name: string
  equity_pct: number
  role: string
  commitment: string
}

export interface FounderProfile {
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
