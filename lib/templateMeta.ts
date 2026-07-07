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
  nonprofit_bylaws: ['nonprofit bylaws', 'nonprofit by-laws', 'bylaws', 'by-laws'],
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

// Every distinct template the reply recommends for the user's current
// situation, in keyword-table order. Used by the chat UI to surface Generate
// cards.
//
// Approach (rewritten after repeated live misses): the earlier version required
// a recommendation VERB immediately beside each document name. The model's real
// recommendation phrasings are far too varied for that — "X, Y and Z are your
// three starting-point documents", "you need to start with ... : X, and Y",
// "here's what you need: ..." — and each new phrasing silently produced NO card,
// breaking the core flow. So detection is now inverted: a document name in a
// non-question reply DOES surface a card, UNLESS the mention is negated, a future
// hypothetical, a correction, or part of a "like / such as / any" topic list —
// which is exactly what isNonRecommendationMention already encodes. Those guards
// (not verb-adjacency) are what actually separate a real recommendation from a
// casual mention, so leaning on them is both simpler and much more robust.
//
// Two coarse gates keep this from over-firing: (1) the whole reply must be a
// non-question — a reply that is still asking a clarifying question is gathering
// context, not recommending; (2) app/page.tsx only renders cards when 1–4
// templates are detected, so a "here are all 15 documents we make" answer (>4)
// surfaces nothing.
export function detectTemplates(text: string): string[] {
  const lower = text.toLowerCase()
  if (lower.includes('?')) return []
  const found: string[] = []
  for (const [template, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
    if (keywords.some((kw) => hasRecommendationMention(lower, kw))) found.push(template)
  }
  return found
}

// True if the keyword appears at least once as a genuine recommendation — i.e.
// present in the text and NOT filtered out by isNonRecommendationMention
// (negation / correction / future hypothetical / topic-list).
function hasRecommendationMention(lowerText: string, keyword: string): boolean {
  let index = lowerText.indexOf(keyword)
  while (index !== -1) {
    if (!isNonRecommendationMention(lowerText, index, keyword.length)) return true
    index = lowerText.indexOf(keyword, index + keyword.length)
  }
  return false
}

function isNonRecommendationMention(lowerText: string, index: number, length: number): boolean {
  const before = lowerText.slice(Math.max(0, index - 90), index)
  const after = lowerText.slice(index + length, Math.min(lowerText.length, index + length + 90))
  const window = `${before}__doc__${after}`

  return [
    /(?:shouldn't|should not|didn't|did not|don't|do not|won't|will not|can't|cannot|isn't|is not|wasn't|was not|no need to|no longer need)\s+(?:have\s+)?(?:mentioned|mention|generated?|generate|recommend(?:ed)?|surface|show|use|need)\s+(?:a\s+|an\s+|the\s+)?__doc__/,
    /(?:my bad|mistake|wrong)\b[^.?!]{0,80}__doc__/,
    /__doc__[^.?!]{0,80}\b(?:isn't|is not|wasn't|was not|doesn't fit|does not fit|is wrong|was wrong|isn't the right|is not the right)\b/,
    /(?:can also help|could also help|we can also help|we could also help|later|eventually|down the road)\b[^.?!]{0,80}__doc__/,
    /(?:like|such as|including|possible|next topics?|any)\b[^.?!]{0,120}__doc__/,
    /(?:like whether|whether|or if|if)\s+you\b[^.?!]{0,80}\b(?:need|have|will|might|plan to)\b[^.?!]{0,80}__doc__/,
    /__doc__[^.?!]{0,80}\b(?:if|when|once|whether)\s+you\b[^.?!]{0,80}\b(?:need|have|will|might|plan to|later|eventually|down the road|bring on|hire|collect|start)\b/,
    /__doc__[^.?!]{0,80}\b(?:if|when|once)\s+you\b[^.?!]{0,80}\b(?:later|eventually|down the road|bring on|hire|collect|start)\b/,
  ].some(pattern => pattern.test(window))
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
