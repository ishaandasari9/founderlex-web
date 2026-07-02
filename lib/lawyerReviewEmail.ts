import type { FounderProfile } from './founderProfile'

export interface GeneratedDoc {
  template: string
  label: string
  filled: string
}

const BLANK_RE = /\[TO BE COMPLETED:?[^\]]*\]/g

export function extractBlanks(filled: string): string[] {
  const matches = filled.match(BLANK_RE) ?? []
  return Array.from(new Set(matches))
}

// Document-specific things a lawyer should check. Keyed by the same template
// ids used in TEMPLATE_FILES (app/api/generate/route.ts) and TEMPLATE_LABELS
// (app/page.tsx). Falls back to GENERIC_CONCERNS for anything not listed.
const CONCERN_HINTS: Record<string, string[]> = {
  founders_agreement: [
    'Whether the vesting schedule and cliff match what the founders actually agreed to',
    'Whether the equity split and IP assignment language hold up under state law',
    "What happens if a founder leaves early, and whether the buyback/forfeiture terms are enforceable",
  ],
  contractor_agreement: [
    'Whether the worker is properly classified as a contractor, not an employee, under state law',
    'Whether the IP assignment / work-for-hire language actually transfers ownership as intended',
  ],
  independent_contractor_consulting: [
    'Whether the worker is properly classified as a contractor, not an employee, under state law',
    'Whether the IP assignment / work-for-hire language actually transfers ownership as intended',
  ],
  unilateral_nda: [
    'Whether the definition of confidential information is broad enough for our situation but not so broad it becomes unenforceable',
    'Whether the term length and carve-outs (independently developed, publicly known, etc.) are reasonable',
  ],
  mutual_nda: [
    'Whether the definition of confidential information is broad enough for our situation but not so broad it becomes unenforceable',
    'Whether the term length and carve-outs (independently developed, publicly known, etc.) are reasonable',
  ],
  advisor_agreement: [
    'Whether the advisor equity grant and vesting terms are standard and enforceable',
    'Whether IP and confidentiality obligations are clear given what the advisor will be exposed to',
  ],
  master_services_agreement: [
    'Whether liability caps, indemnification, and payment terms are balanced and enforceable',
    'Whether IP ownership of deliverables is assigned the way we intend',
  ],
  sow_template: [
    'Whether the scope of work is specific enough to prevent disputes over deliverables',
    'Whether it properly incorporates the terms of our master agreement by reference',
  ],
  consulting_agreement: [
    'Whether the IP assignment addendum actually covers everything we need it to',
  ],
  terms_of_service: [
    'Whether the limitation of liability and dispute resolution clauses are enforceable in our state',
    'Whether it covers our actual product behavior (user content, subscriptions, data use, etc.)',
  ],
  privacy_policy: [
    'Whether it accurately reflects what data we actually collect and how we use or share it',
    'Whether we need additional disclosures given who and where our users are (e.g. CCPA, GDPR)',
  ],
  nonprofit_articles: [
    "Whether the language meets our state's specific requirements for nonprofit incorporation",
    'Whether it includes the language the IRS requires for 501(c)(3) exemption eligibility',
  ],
  nonprofit_bylaws: [
    "Whether the governance structure (board size, terms, voting) matches our state's nonprofit statute",
    'Whether the conflict-of-interest and dissolution clauses meet IRS requirements',
  ],
  nonprofit_conflict_of_interest: [
    "Whether it meets the IRS's model conflict-of-interest policy language for Form 1023",
  ],
  donation_acknowledgment_letter: [
    'Whether it includes the language the IRS requires for donors to claim a tax deduction',
  ],
}

const GENERIC_CONCERNS = [
  'Whether this document reflects our state\'s law accurately',
  'Whether anything here creates unexpected liability for the business or for us personally',
]

function concernsFor(template: string): string[] {
  return CONCERN_HINTS[template] ?? GENERIC_CONCERNS
}

function summarizeBusiness(profile: FounderProfile): string {
  const name = profile.company_name || 'Our company'
  const typeLabel =
    profile.business_type === 'nonprofit' ? 'a nonprofit organization'
    : profile.business_type === 'consulting' ? 'a consulting/services business'
    : profile.business_type === 'product' ? 'a product-based startup'
    : 'an early-stage business'

  let overview = `${name} is ${typeLabel}`
  if (profile.structure) overview += `, structured as a ${profile.structure}`
  if (profile.state) overview += ` in ${profile.state}`
  overview += '.'

  const lines = [overview]
  if (profile.product_description) {
    const desc = profile.product_description.trim()
    const punctuated = /[.!?]$/.test(desc) ? desc : `${desc}.`
    lines.push(`In plain terms, here's what we do: ${punctuated}`)
  }
  if (profile.founders.length > 0) {
    const names = profile.founders.map(f => f.name || 'an unnamed founder').join(', ')
    lines.push(`Founding team: ${names}.`)
  }
  if (profile.handles_user_data) lines.push('We handle user data and/or payments.')
  if (profile.has_ip) lines.push('We have intellectual property (product, brand, or content) we want to protect.')

  return lines.join(' ')
}

export function buildLawyerReviewEmail(profile: FounderProfile, docs: GeneratedDoc[]): string {
  const companyName = profile.company_name || 'our company'
  const founderNames = profile.founders.map(f => f.name).filter(Boolean)
  const signOff = founderNames.length > 0 ? founderNames.join(' and ') : '[Your name]'
  const plural = docs.length > 1

  const docList = docs.map(d => `- ${d.label}`).join('\n')

  const concernLines = Array.from(new Set(
    docs.flatMap(d => concernsFor(d.template).map(c => `- (${d.label}) ${c}`))
  ))

  const blanksByDoc = docs
    .map(d => ({ label: d.label, blanks: extractBlanks(d.filled) }))
    .filter(d => d.blanks.length > 0)

  const lines: string[] = []
  lines.push(`Subject: Request for legal review — ${companyName} startup document${plural ? 's' : ''}`)
  lines.push('')
  lines.push("Hi [Attorney's name],")
  lines.push('')
  lines.push(`I'm reaching out because I'd like your help reviewing some startup legal documents before we rely on them. ${summarizeBusiness(profile)}`)
  lines.push('')
  lines.push(`I used FounderLex, an educational tool, to put together first drafts of the following document${plural ? 's' : ''}:`)
  lines.push(docList)
  lines.push('')
  lines.push('Could you review them, tell me if they hold up, and fix anything that needs it? Specifically, I would appreciate it if you could check:')
  lines.push(concernLines.join('\n'))

  if (blanksByDoc.length > 0) {
    lines.push('')
    lines.push("Also, there are a few blanks I wasn't able to fill in myself and left marked for you:")
    lines.push(blanksByDoc.map(d => `- ${d.label}: ${d.blanks.join('; ')}`).join('\n'))
  }

  lines.push('')
  lines.push('A few questions I have for you, in case it helps to know what is on my mind:')
  lines.push([
    '- Is this the right document, or is there something else we should have in place instead or in addition?',
    '- Are there state-specific requirements we might be missing?',
    '- Is there anything here that puts a founder personally on the hook instead of the business?',
  ].join('\n'))

  lines.push('')
  lines.push(
    "For context: FounderLex is not a law firm and does not provide legal advice. It's an educational AI tool, and these documents are AI-generated starting-point drafts only, not reviewed by an attorney. We have not signed, relied on, or filed any of them and will not until you've reviewed and revised them as needed."
  )
  lines.push('')
  lines.push('Thank you for your time,')
  lines.push(signOff)

  return lines.join('\n')
}
