// A3 inline source citations (README-v3-trust-and-delivery.md, Part A, A3).
// Each entry below tags a specific passage in skill/references/*.md with a
// source label + official URL, so a substantive legal answer can show the
// founder exactly where a claim comes from. Every URL here was manually
// verified (2026-07-02) to be a real, live, official page before being
// added — this is a hand-curated list, not something a model generates at
// request time, per the "never fabricate one" rule: if no entry below
// genuinely matches, no citation is shown, full stop.
//
// Deliberately incomplete: liability-basics.md and contracts-basics.md have
// no entries. Both cover state common-law doctrine (piercing the corporate
// veil, what makes a contract enforceable) with no single official
// government page that states it authoritatively — inventing a citation for
// those would be exactly the fabrication this feature exists to prevent.
// Donation-acknowledgment specifics (nonprofit-basics.md Section 10, the
// $250 threshold / IRS Pub 1771) are also uncited for now: several plausible
// IRS URLs were checked and none resolved, so it's left out rather than
// guessed at. Same standard applies to any future addition — verify before
// citing.

export interface Citation {
  id: string
  // Which skill/references/*.md file this passage lives in. A citation is
  // only ever surfaced when this file was ALSO selected as grounding
  // context by lib/selectReferences.ts's selectReferenceFiles — so a
  // citation can never point at something the model didn't actually see.
  file: string
  label: string
  url: string
  // Topic-specific keywords, checked against the model's final ANSWER text
  // (claim-aware — see selectCitations below), not the founder's question.
  // Finer grained than selectReferenceFiles' own per-file keyword lists,
  // since a single reference file (e.g. ip-basics.md) covers several
  // distinct topics that each need their own separate, correct citation.
  keywords: string[]
}

export const CITATIONS: Citation[] = [
  // ── ip-basics.md ──────────────────────────────────────────────────────────
  {
    id: 'trademark-search',
    file: 'ip-basics.md',
    label: 'USPTO — Trademark Search',
    url: 'https://www.uspto.gov/trademarks/search',
    keywords: ['trademark', 'brand name', 'logo'],
  },
  {
    id: 'copyright-registration',
    file: 'ip-basics.md',
    label: 'U.S. Copyright Office — Registration Portal',
    url: 'https://www.copyright.gov/registration/',
    keywords: ['copyright'],
  },
  {
    id: 'trade-secret-policy',
    file: 'ip-basics.md',
    label: 'USPTO — Trade Secret Policy',
    url: 'https://www.uspto.gov/ip-policy/trade-secret-policy',
    keywords: ['trade secret'],
  },
  {
    id: 'patent-basics',
    file: 'ip-basics.md',
    label: 'USPTO — Patent Basics',
    url: 'https://www.uspto.gov/patents/basics',
    keywords: ['patent', 'invention'],
  },
  // NDA (ip-basics.md Section 4): no citation — an NDA's enforceability is
  // ordinary contract law, no official government source states it.

  // ── business-structures.md ──────────────────────────────────────────────
  {
    id: 's-corp-election',
    file: 'business-structures.md',
    label: 'IRS — S Corporations',
    url: 'https://www.irs.gov/businesses/small-businesses-self-employed/s-corporations',
    keywords: ['s-corp', 's corp'],
  },
  {
    id: 'choose-business-structure',
    file: 'business-structures.md',
    label: 'SBA — Choose a Business Structure',
    url: 'https://www.sba.gov/business-guide/launch-your-business/choose-business-structure',
    keywords: ['llc', 'c-corp', 'c corp', 'sole proprietorship', 'partnership', 'business structure', 'entity type', 'incorporate'],
  },
  {
    id: 'delaware-incorporation',
    file: 'business-structures.md',
    label: 'Delaware Division of Corporations',
    url: 'https://corp.delaware.gov/',
    keywords: ['delaware', 'venture capital'],
  },
  {
    id: '83b-election',
    file: 'business-structures.md',
    label: '26 U.S.C. § 83(b) (Cornell Law School, Legal Information Institute)',
    url: 'https://www.law.cornell.edu/uscode/text/26/83',
    keywords: ['83(b)', '83b', 'section 83'],
  },

  // ── compliance-basics.md ──────────────────────────────────────────────────
  {
    id: 'ein-application-compliance',
    file: 'compliance-basics.md',
    label: 'IRS — Apply for an EIN (Free)',
    url: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online',
    keywords: ['ein'],
  },

  // ── consulting-basics.md ──────────────────────────────────────────────────
  {
    id: 'work-made-for-hire',
    file: 'consulting-basics.md',
    label: '17 U.S.C. § 101 — "Work Made for Hire" (Cornell Law School, Legal Information Institute)',
    url: 'https://www.law.cornell.edu/uscode/text/17/101',
    keywords: ['work for hire', 'work-for-hire'],
  },
  {
    id: 'worker-classification',
    file: 'consulting-basics.md',
    label: 'IRS — Independent Contractor (Self-Employed) or Employee?',
    url: 'https://www.irs.gov/businesses/small-businesses-self-employed/independent-contractor-self-employed-or-employee',
    keywords: ['worker classification', 'independent contractor', 'misclassif'],
  },

  // ── nonprofit-basics.md ───────────────────────────────────────────────────
  {
    id: 'ein-application-nonprofit',
    file: 'nonprofit-basics.md',
    label: 'IRS — Apply for an EIN (Free)',
    url: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online',
    keywords: ['ein'],
  },
  {
    id: 'form-1023',
    file: 'nonprofit-basics.md',
    label: 'IRS — Application for Recognition of Exemption (Form 1023)',
    url: 'https://www.irs.gov/charities-non-profits/application-for-recognition-of-exemption',
    keywords: ['form 1023', '1023-ez', '501(c)(3)', '501c3'],
  },
  {
    id: 'conflict-of-interest-policy',
    file: 'nonprofit-basics.md',
    label: 'IRS — Instructions for Form 1023 (Appendix A: Sample Conflict of Interest Policy)',
    url: 'https://www.irs.gov/instructions/i1023',
    keywords: ['conflict of interest'],
  },
  {
    id: 'form-990-annual-filing',
    file: 'nonprofit-basics.md',
    label: 'IRS — Annual Filing and Forms (Form 990 Series)',
    url: 'https://www.irs.gov/charities-non-profits/annual-filing-and-forms',
    keywords: ['form 990', '990-n', '990-ez', 'annual report'],
  },
]

// Zero-tolerance domain allowlist: a citation may only ever point at an
// official government page or a recognized legal-institution mirror of
// federal statute text (Cornell LII, used elsewhere in this project for
// citing the U.S. Code). Deterministic and offline — this checks the URL's
// shape, not live reachability (every URL above was checked for that
// separately, by hand, before being added).
const ALLOWED_DOMAINS = ['irs.gov', 'uspto.gov', 'copyright.gov', 'sba.gov', 'law.cornell.edu', 'corp.delaware.gov', 'fincen.gov']

export function isOfficialCitationUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
    return ALLOWED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

export interface SelectedCitation {
  label: string
  url: string
}

// A real answer draws on at most a couple of specific facts, not a wall of
// footnotes — matches selectReferenceFiles' own MAX_FILES cap.
const MAX_CITATIONS = 2

// Claim-aware (Codex audit, Med #3): the original version matched keywords
// against the founder's QUESTION, not the model's ANSWER. That meant a
// citation could show up purely because the question raised a topic, even
// if the model's actual reply never used the cited fact at all — e.g. the
// model declining to answer ("I don't have that in my notes, ask a
// lawyer") would still have earned an 83(b) citation just because the
// question mentioned 83(b). A citation only means something if it points
// at a claim the answer actually makes.
//
// Matches keyword against the FINAL ANSWER TEXT instead, with the same
// double gate as before: a citation is only selected if BOTH (a) its topic
// keywords appear in what the model actually said, AND (b) its file is
// among the files selectReferenceFiles chose as grounding context for this
// turn — so a citation can never be shown for a passage the model wasn't
// actually given, and never for a claim the model didn't actually make.
export function selectCitations(referenceFiles: string[], answerText: string): SelectedCitation[] {
  const lower = ` ${answerText.toLowerCase()} `
  const matches = CITATIONS.filter(
    (c) => referenceFiles.includes(c.file) && c.keywords.some((kw) => lower.includes(kw)),
  )

  // Dedupe by URL: two citations can legitimately point at the same page
  // (the EIN page is cited from both compliance-basics.md and
  // nonprofit-basics.md), and the same link should never show twice.
  const seen = new Set<string>()
  const deduped: SelectedCitation[] = []
  for (const c of matches) {
    if (seen.has(c.url)) continue
    seen.add(c.url)
    deduped.push({ label: c.label, url: c.url })
  }

  return deduped.slice(0, MAX_CITATIONS)
}
