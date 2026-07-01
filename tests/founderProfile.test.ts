import { validateProfile, type FounderProfile } from '../lib/founderProfile'

function baseProfile(founders: FounderProfile['founders']): FounderProfile {
  return {
    product_description: '',
    business_type: null,
    founders,
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

function founder(name: string, equity_pct: number) {
  return { name, equity_pct, role: 'Founder', commitment: 'full-time' }
}

interface Case {
  name: string
  profile: FounderProfile
  expectValid: boolean
  expectErrorIncludes?: string
}

const cases: Case[] = [
  {
    name: 'three equal founders (33.3 x3) passes',
    profile: baseProfile([founder('Alex', 33.3), founder('Bri', 33.3), founder('Cass', 33.3)]),
    expectValid: true,
  },
  {
    name: 'three founders at 50 each fails with sum-based message',
    profile: baseProfile([founder('Alex', 50), founder('Bri', 50), founder('Cass', 50)]),
    expectValid: false,
    expectErrorIncludes: '150',
  },
  {
    name: 'uneven split 55/35/10 passes',
    profile: baseProfile([founder('Alex', 55), founder('Bri', 35), founder('Cass', 10)]),
    expectValid: true,
  },
  {
    name: 'missing founder name fails',
    profile: baseProfile([founder('Alex', 50), founder('', 50)]),
    expectValid: false,
    expectErrorIncludes: 'missing a name',
  },
]

let failures = 0

for (const c of cases) {
  const result = validateProfile(c.profile)
  let pass = result.valid === c.expectValid
  if (pass && c.expectErrorIncludes) {
    pass = result.errors.some((e) => e.includes(c.expectErrorIncludes!))
  }

  if (pass) {
    console.log(`PASS  ${c.name}`)
  } else {
    failures++
    console.log(`FAIL  ${c.name}`)
    console.log(`      expected valid=${c.expectValid}${c.expectErrorIncludes ? ` with error including "${c.expectErrorIncludes}"` : ''}`)
    console.log(`      got valid=${result.valid} errors=${JSON.stringify(result.errors)}`)
  }
}

console.log(`\n${cases.length - failures}/${cases.length} passed`)
if (failures > 0) process.exit(1)
