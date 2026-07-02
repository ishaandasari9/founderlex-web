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
