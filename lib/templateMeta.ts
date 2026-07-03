// Canonical template metadata: human-readable labels and the keyword lists
// used to detect a template mention in free text. Moved out of app/page.tsx
// (B2 prereq) so it's usable server-side too — the Founder Pack needs to
// resolve each free-text entry in FounderProfile.recommended_documents
// (whatever phrasing the extraction model used, e.g. "Founders' Agreement")
// down to the internal template_name keys generateDocument expects, and
// that resolution has to use the SAME keyword list the chat UI already uses
// to detect a doc-card recommendation, not a second, driftable copy.
//
// app/page.tsx imports TEMPLATE_LABELS/detectTemplate from here now instead
// of defining its own copy. components/ConfirmDocPanel.tsx still has its
// own separate TEMPLATE_LABELS copy (pre-existing duplication, not touched
// here — out of scope for this change).

export const TEMPLATE_LABELS: Record<string, string> = {
  founders_agreement: "Founders' Agreement",
  contractor_agreement: 'Contractor Agreement',
  unilateral_nda: 'Unilateral NDA',
  mutual_nda: 'Mutual NDA',
  advisor_agreement: 'Advisor Agreement',
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  consulting_agreement: 'Consulting Agreement',
  master_services_agreement: 'Master Services Agreement',
  sow_template: 'Statement of Work',
  independent_contractor_consulting: 'Independent Contractor Agreement',
  nonprofit_articles: 'Articles of Incorporation',
  nonprofit_bylaws: 'Nonprofit Bylaws',
  nonprofit_conflict_of_interest: 'Conflict of Interest Policy',
  donation_acknowledgment_letter: 'Donation Acknowledgment Letter',
}

export const TEMPLATE_KEYWORDS: Record<string, string[]> = {
  advisor_agreement: ['advisor agreement', 'advisory agreement'],
  founders_agreement: ["founders' agreement", "founder agreement", "equity split", "vesting schedule", "founders agreement"],
  contractor_agreement: ['contractor agreement', 'freelancer agreement', 'work for hire'],
  unilateral_nda: ['unilateral nda', 'one-way nda', 'unilateral non-disclosure', 'one-way non-disclosure'],
  mutual_nda: ['non-disclosure agreement', 'confidentiality agreement', 'mutual nda'],
  terms_of_service: ['terms of service', 'terms and conditions'],
  privacy_policy: ['privacy policy'],
  consulting_agreement: ['consulting agreement'],
  master_services_agreement: ['master services agreement', 'master service agreement'],
  sow_template: ['statement of work'],
  independent_contractor_consulting: ['independent contractor agreement'],
  nonprofit_articles: ['articles of incorporation', 'nonprofit articles'],
  nonprofit_bylaws: ['nonprofit bylaws', 'nonprofit by-laws'],
  nonprofit_conflict_of_interest: ['conflict of interest policy'],
  donation_acknowledgment_letter: ['donation acknowledgment letter', 'donation acknowledgement letter', 'donation receipt letter'],
}

export function detectTemplate(text: string): string | null {
  const lower = text.toLowerCase()
  for (const [template, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return template
  }
  return null
}

// Every distinct template the text mentions, in keyword-table order. Unlike
// detectTemplate (first match only), this lets a caller tell a targeted
// recommendation ("you'll want a Founders' Agreement") apart from a catalog
// listing that names many documents ("here are all 15 we make") — the chat UI
// uses the count to decide whether to surface a Generate card at all, so a
// "what do you make?" answer doesn't spuriously attach a card for whichever
// document happens to be named first.
export function detectTemplates(text: string): string[] {
  const lower = text.toLowerCase()
  const found: string[] = []
  for (const [template, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) found.push(template)
  }
  return found
}

// B2 Founder Pack: resolve FounderProfile.recommended_documents (free
// text, whatever phrasing the extraction model used) down to template_name
// keys via detectTemplate above. Deliberately kept in this dependency-free
// module (only a type import from founderProfile) rather than in
// lib/founderPack.ts — that module pulls in lib/generateDocument.ts, which
// imports 'fs' and Node-only packages (pdfkit, html-to-docx), and this
// function needs to run CLIENT-SIDE too (app/page.tsx uses it to build the
// Founder Pack confirm panel before ever calling the API). Deduped; an
// entry that doesn't resolve to a known template is silently dropped
// rather than failing the whole pack.
export function resolveRecommendedTemplates(profile: { recommended_documents: string[] }): string[] {
  const resolved: string[] = []
  const seen = new Set<string>()
  for (const entry of profile.recommended_documents) {
    const key = detectTemplate(entry)
    if (key && !seen.has(key)) {
      seen.add(key)
      resolved.push(key)
    }
  }
  return resolved
}
