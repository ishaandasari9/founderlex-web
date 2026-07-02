import { validateProfile, type FounderProfile } from './founderProfile'
import { TEMPLATE_LABELS, resolveRecommendedTemplates } from './templateMeta'
import { generateDocument, type GeneratedDocumentResult } from './generateDocument'
import { extractBlanks } from './lawyerReviewEmail'

// B2 one-click Founder Pack (README-v3-trust-and-delivery.md, Part B, B2).
// "Reuse the single-document generator in a loop over the recommended set —
// do NOT write a second generation path. One engine, many documents."
// generateFounderPack below calls the exact same generateDocument()
// app/api/generate/route.ts uses, once per recommended template.

// Re-exported so existing imports of resolveRecommendedTemplates from this
// module keep working — the definition itself lives in
// lib/templateMeta.ts, a dependency-free module, since app/page.tsx needs
// to call it CLIENT-SIDE (before ever hitting the API) and this module
// pulls in lib/generateDocument.ts's Node-only imports (fs, pdfkit,
// html-to-docx), which can't be bundled for the browser.
export { resolveRecommendedTemplates }

// One-line, plain-English "what this document is for" — distinct from
// lib/lawyerReviewEmail.ts's CONCERN_HINTS ("what a lawyer should check"),
// which answers a different question. Falls back to a generic line for any
// template not listed (keeps the cover memo from ever silently omitting a
// document's description).
const WHAT_ITS_FOR: Record<string, string> = {
  founders_agreement: 'Locks in your equity split, vesting, IP assignment, and what happens if a founder leaves.',
  contractor_agreement: "Governs a hired contractor's work and assigns the IP in that work to the company.",
  independent_contractor_consulting: "Governs a hired contractor's work and assigns the IP in that work to the company.",
  unilateral_nda: 'Protects confidential information you share one-way with someone who has nothing to share back.',
  mutual_nda: 'Protects confidential information both sides share while exploring a deal or partnership.',
  advisor_agreement: 'Sets scope, term, and the equity grant for an advisor giving periodic strategic guidance.',
  master_services_agreement: 'The umbrella contract for an ongoing consulting relationship — liability, IP, payment terms.',
  sow_template: 'Locks in scope, deliverables, timeline, and rates for one specific consulting engagement.',
  consulting_agreement: 'Spells out the IP split between what a consultant keeps and what a client owns.',
  terms_of_service: 'The contract between your company and your users governing use of your product.',
  privacy_policy: 'Discloses what data you collect from users and how you use or share it.',
  nonprofit_articles: "Forms your nonprofit corporation with your state, with the IRS-required purpose/dissolution language.",
  nonprofit_bylaws: "Sets your nonprofit's internal governance: board, officers, meetings, decisions.",
  nonprofit_conflict_of_interest: 'Governs what happens when a board member has a personal stake in a decision.',
  donation_acknowledgment_letter: 'Gives donors the written acknowledgment the IRS requires for tax-deductible gifts.',
}

function whatItsFor(templateName: string): string {
  return WHAT_ITS_FOR[templateName] ?? 'A starter legal document for your business.'
}

export interface FounderPackDoc {
  template_name: string
  label: string
  filled: string
  docx_b64: string
  docx_name: string
  pdf_b64: string
  pdf_name: string
}

export interface FounderPackResult {
  templateNames: string[]
  docs: FounderPackDoc[]
  coverMemo: string
  profileValidation: { valid: boolean; errors: string[] }
}

// Plain-English cover memo: what's included, what each doc is for, and
// which [TO BE COMPLETED] blanks are still outstanding — reusing
// lib/lawyerReviewEmail.ts's extractBlanks (same blank-detection regex the
// Lawyer Review Email already uses) rather than a second implementation.
// Addressed to the founder, not an attorney — a distinct document from the
// Lawyer Review Email, built on the same helpers.
export function buildCoverMemo(
  profile: FounderProfile,
  docs: FounderPackDoc[],
  profileValidation: { valid: boolean; errors: string[] },
): string {
  const companyName = profile.company_name || 'your company'
  const founderNames = profile.founders.map((f) => f.name).filter(Boolean)
  const signOff = founderNames.length > 0 ? founderNames.join(' and ') : null

  const lines: string[] = []
  lines.push(`Your FounderLex Founder Pack — ${docs.length} document${docs.length === 1 ? '' : 's'} for ${companyName}`)
  lines.push('')
  lines.push(
    `Here's everything FounderLex put together based on what you told it about ${companyName}. Each one is an educational starting-point draft, not a finished, signable document.`,
  )
  lines.push('')
  lines.push("What's included:")
  for (const d of docs) {
    lines.push(`- ${d.label}: ${whatItsFor(d.template_name)}`)
  }

  const blanksByDoc = docs
    .map((d) => ({ label: d.label, blanks: extractBlanks(d.filled) }))
    .filter((d) => d.blanks.length > 0)

  lines.push('')
  if (blanksByDoc.length > 0) {
    lines.push('Blanks still need filling in before any of these are ready to sign or file:')
    for (const d of blanksByDoc) {
      lines.push(`- ${d.label}: ${d.blanks.join('; ')}`)
    }
  } else {
    lines.push(
      'No [TO BE COMPLETED] blanks are left in these drafts based on what you told FounderLex — but double-check every field before relying on them.',
    )
  }

  if (!profileValidation.valid) {
    lines.push('')
    lines.push("Something to double-check before you go further, flagged automatically, not just a suggestion:")
    for (const err of profileValidation.errors) lines.push(`- ${err}`)
  }

  lines.push('')
  lines.push(
    'Have a licensed attorney review every document in this pack before you sign, file, or send it to anyone. FounderLex is an educational tool, not a law firm, and nothing here is legal advice.',
  )
  lines.push('')
  lines.push(signOff ? `${signOff} — via FounderLex` : '— FounderLex')

  return lines.join('\n')
}

// Deterministic, no LLM call: renderTemplate should never produce a leaked
// {{ }} / {% %} tag, but if it ever does, that is a real bug, and the pack
// must fail rather than silently hand the founder a broken document
// (fail-safe generation — README-v3 / July9-Focus backend hardening note).
const LEAK_RE = /\{\{|\{%/

// THE Founder Pack orchestration: resolve the recommended template set,
// generate each one via the SAME generateDocument() engine
// app/api/generate/route.ts uses (never a second generation path), run the
// same validation every single-document generation already gets
// (validateProfile's equity/required-field checks, plus the leak guard
// above) across every document in the pack, and build the cover memo.
export async function generateFounderPack(profile: FounderProfile): Promise<FounderPackResult> {
  const templateNames = resolveRecommendedTemplates(profile)
  if (templateNames.length === 0) {
    throw new Error(
      'No recommended documents to include in a Founder Pack yet — chat with FounderLex to get document recommendations first.',
    )
  }

  const profileValidation = validateProfile(profile)

  const generated: GeneratedDocumentResult[] = await Promise.all(
    templateNames.map((templateName) => generateDocument(templateName, profile)),
  )

  for (const g of generated) {
    if (LEAK_RE.test(g.filled)) {
      throw new Error(`Generated ${g.template_name} contains a leaked template tag — refusing to include it in the pack.`)
    }
  }

  const docs: FounderPackDoc[] = generated.map((g) => ({
    template_name: g.template_name,
    label: TEMPLATE_LABELS[g.template_name] ?? g.template_name,
    filled: g.filled,
    docx_b64: g.docx_b64,
    docx_name: g.docx_name,
    pdf_b64: g.pdf_b64,
    pdf_name: g.pdf_name,
  }))

  const coverMemo = buildCoverMemo(profile, docs, profileValidation)

  return { templateNames, docs, coverMemo, profileValidation }
}
