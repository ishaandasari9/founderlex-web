import { extractBlanks } from './lawyerReviewEmail'

export interface ChecklistItem {
  id: string
  text: string
}

// Sections worth a lawyer's attention before relying on this document type.
// Keyed by the same template ids used in TEMPLATE_FILES (app/api/generate/route.ts)
// and TEMPLATE_LABELS (app/page.tsx). Falls back to GENERIC_HIGH_RISK.
const HIGH_RISK_SECTIONS: Record<string, string[]> = {
  founders_agreement: [
    "the equity split and whether every founder's percentage adds up to 100%",
    'the vesting schedule and cliff',
    'what happens if a founder leaves early (buyback/forfeiture terms)',
  ],
  contractor_agreement: [
    'the worker classification (contractor vs. employee)',
    'the IP assignment / work-for-hire language',
  ],
  independent_contractor_consulting: [
    'the worker classification (contractor vs. employee)',
    'the IP assignment / work-for-hire language',
  ],
  unilateral_nda: [
    'the term (how long confidentiality lasts) and the parties named',
    'the definition of confidential information',
  ],
  mutual_nda: [
    'the term (how long confidentiality lasts) and the parties named',
    'the definition of confidential information',
  ],
  advisor_agreement: [
    'the equity grant and vesting terms',
    'the confidentiality and IP obligations',
  ],
  master_services_agreement: [
    'the liability caps and indemnification language',
    'the payment terms',
  ],
  sow_template: [
    'the scope of work and deliverables',
    'how it references the master agreement',
  ],
  consulting_agreement: [
    'the IP assignment addendum',
  ],
  terms_of_service: [
    'the limitation of liability and dispute resolution clauses',
  ],
  privacy_policy: [
    'whether it matches what data you actually collect and how you use it',
  ],
  nonprofit_articles: [
    'the organizational purpose clause and dissolution clause (the IRS requires specific language here)',
  ],
  nonprofit_bylaws: [
    'the board size, voting rules, and the conflict-of-interest and dissolution provisions',
  ],
  nonprofit_conflict_of_interest: [
    "whether it matches the IRS's model conflict-of-interest policy",
  ],
  donation_acknowledgment_letter: [
    'whether it includes the language donors need to claim a tax deduction',
  ],
}

const GENERIC_HIGH_RISK = ['any section describing money, ownership, or liability']

function highRiskFor(template: string): string[] {
  return HIGH_RISK_SECTIONS[template] ?? GENERIC_HIGH_RISK
}

// Extra, document-type-specific steps beyond the universal checklist below.
const EXTRA_STEPS: Record<string, string[]> = {
  nonprofit_articles: [
    "File this with your state's Secretary of State first — the IRS won't accept a 501(c)(3) application until the nonprofit corporation exists at the state level.",
    'After the state files it, get a free EIN directly from irs.gov (never pay a third-party site for this), then work with a CPA or nonprofit attorney to determine whether you qualify for Form 1023-EZ or need the full Form 1023.',
  ],
  nonprofit_bylaws: [
    'Adopt this alongside a Conflict of Interest Policy before you file Form 1023 — the IRS application asks whether both are in place.',
  ],
  nonprofit_conflict_of_interest: [
    'Have every board member sign a disclosure confirming they have read and agree to follow this policy.',
  ],
  founders_agreement: [
    'If a co-founder joins later, they need to sign an updated version — this agreement only covers the people named in it.',
  ],
}

export function buildChecklist(template: string, filled: string): ChecklistItem[] {
  const blanks = extractBlanks(filled)
  const blanksText = blanks.length > 0
    ? `Fill in the ${blanks.length} remaining blank${blanks.length > 1 ? 's' : ''}: ${blanks.join('; ')}.`
    : 'Double-check there are no [TO BE COMPLETED] blanks left anywhere in the document.'

  const texts = [
    blanksText,
    'Review every name, date, percentage, dollar amount, and signature line for accuracy.',
    'Confirm the document matches what everyone actually agreed to, not just what looks right on paper.',
    `Have a lawyer review the highest-risk sections before you rely on this: ${highRiskFor(template).join('; ')}.`,
    "Don't sign, file, or send it until you understand every section of it.",
    'Once everyone has signed, save a copy of the final version somewhere safe and share it with every signer.',
    ...(EXTRA_STEPS[template] ?? []),
  ]

  return texts.map((text, i) => ({ id: `item-${i}`, text }))
}
