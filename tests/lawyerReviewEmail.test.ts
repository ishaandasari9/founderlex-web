import { buildLawyerReviewEmail, extractBlanks, type GeneratedDoc } from '../lib/lawyerReviewEmail'
import { emptyProfile, type FounderProfile } from '../lib/founderProfile'

interface Case {
  name: string
  run: () => boolean
  detail?: string
}

const profile: FounderProfile = {
  ...emptyProfile(),
  company_name: 'Acme Robotics',
  product_description: 'a subscription box for hobby robotics kits',
  business_type: 'product',
  founders: [
    { name: 'Alex Kim', equity_pct: 60, role: 'CEO', commitment: 'full-time' },
    { name: 'Bri Nguyen', equity_pct: 40, role: 'CTO', commitment: 'full-time' },
  ],
  registered: false,
  structure: 'Delaware C-corp',
  state: 'Delaware',
}

const foundersDoc: GeneratedDoc = {
  template: 'founders_agreement',
  label: "Founders' Agreement",
  filled: 'This agreement covers vesting. [TO BE COMPLETED: cliff period] applies to all founders.',
}

const ndaDoc: GeneratedDoc = {
  template: 'mutual_nda',
  label: 'Mutual NDA',
  filled: 'No blanks left in this one.',
}

const cases: Case[] = [
  {
    name: 'extractBlanks finds a bracketed TO BE COMPLETED marker',
    run: () => {
      const blanks = extractBlanks(foundersDoc.filled)
      return blanks.length === 1 && blanks[0] === '[TO BE COMPLETED: cliff period]'
    },
  },
  {
    name: 'extractBlanks returns empty array when there are no blanks',
    run: () => extractBlanks(ndaDoc.filled).length === 0,
  },
  {
    name: 'extractBlanks dedupes repeated identical blanks',
    run: () => {
      const text = '[TO BE COMPLETED: state] and again [TO BE COMPLETED: state].'
      return extractBlanks(text).length === 1
    },
  },
  {
    name: 'email includes the not-a-law-firm / not-legal-advice disclaimer',
    run: () => {
      const email = buildLawyerReviewEmail(profile, [foundersDoc])
      return email.includes('FounderLex is not a law firm') && email.includes('does not provide legal advice')
    },
  },
  {
    name: 'email lists every generated document by label',
    run: () => {
      const email = buildLawyerReviewEmail(profile, [foundersDoc, ndaDoc])
      return email.includes("Founders' Agreement") && email.includes('Mutual NDA')
    },
  },
  {
    name: 'email surfaces unresolved [TO BE COMPLETED] blanks for the lawyer',
    run: () => {
      const email = buildLawyerReviewEmail(profile, [foundersDoc])
      return email.includes('[TO BE COMPLETED: cliff period]')
    },
  },
  {
    name: 'email omits the blanks section when no document has unresolved blanks',
    run: () => {
      const email = buildLawyerReviewEmail(profile, [ndaDoc])
      return !email.toLowerCase().includes("wasn't able to fill in")
    },
  },
  {
    name: 'email includes the founder business summary from FounderProfile',
    run: () => {
      const email = buildLawyerReviewEmail(profile, [foundersDoc])
      return email.includes('Acme Robotics') && email.includes('subscription box for hobby robotics kits')
    },
  },
  {
    name: 'email signs off with founder names when available',
    run: () => {
      const email = buildLawyerReviewEmail(profile, [foundersDoc])
      return email.trim().endsWith('Alex Kim and Bri Nguyen')
    },
  },
  {
    name: 'email falls back to a placeholder sign-off with no founders on file',
    run: () => {
      const email = buildLawyerReviewEmail(emptyProfile(), [foundersDoc])
      return email.trim().endsWith('[Your name]')
    },
  },
]

let failures = 0

for (const c of cases) {
  const pass = c.run()
  if (pass) {
    console.log(`PASS  ${c.name}`)
  } else {
    failures++
    console.log(`FAIL  ${c.name}`)
  }
}

console.log(`\n${cases.length - failures}/${cases.length} passed`)
if (failures > 0) process.exit(1)
