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
  // Claim predicate, checked against the model's final ANSWER text (not
  // the founder's question). Each inner array is a set of interchangeable
  // synonyms for ONE required claim component (OR within the group — any
  // one alternative satisfies it); ALL outer groups must have at least one
  // match for the citation to apply (AND across groups).
  //
  // Codex re-review (Med #2): a single flat OR-matched keyword list made
  // citations topic-aware, not claim-aware — e.g. the 83(b) citation fired
  // on the bare word "83(b)" alone, even for an answer that mentioned the
  // topic but declined to actually state the deadline. A citation should
  // only attach when the answer states the SPECIFIC claim the source
  // supports, not merely when it brushes past the general subject. Narrow,
  // fact-specific citations (a statute, a numeric deadline/threshold) get
  // multiple required groups; broad topic-overview citations (a general
  // government guide covering many sub-topics at once) reasonably keep a
  // single group, since there's no one narrower "claim" to require beyond
  // the topic itself.
  requiredClaims: string[][]
}

export const CITATIONS: Citation[] = [
  // ── ip-basics.md ──────────────────────────────────────────────────────────
  {
    id: 'trademark-search',
    file: 'ip-basics.md',
    label: 'USPTO — Trademark Search',
    url: 'https://www.uspto.gov/trademarks/search',
    // The claim this page supports is specifically "search before you
    // file" — requiring both terms means a bare mention of "trademark"
    // (e.g. discussing ™ vs ® with no search guidance) doesn't cite it.
    requiredClaims: [['trademark'], ['search']],
  },
  {
    id: 'copyright-registration',
    file: 'ip-basics.md',
    label: 'U.S. Copyright Office — Registration Portal',
    url: 'https://www.copyright.gov/registration/',
    requiredClaims: [['copyright'], ['regist']], // 'regist' covers register/registered/registration
  },
  {
    id: 'trade-secret-policy',
    file: 'ip-basics.md',
    label: 'USPTO — Trade Secret Policy',
    url: 'https://www.uspto.gov/ip-policy/trade-secret-policy',
    // "trade secret" is already a specific two-word phrase, not a generic
    // topic keyword — a single required group is precise enough here.
    requiredClaims: [['trade secret']],
  },
  {
    id: 'patent-basics',
    file: 'ip-basics.md',
    label: 'USPTO — Patent Basics',
    url: 'https://www.uspto.gov/patents/basics',
    requiredClaims: [['patent']],
  },
  // NDA (ip-basics.md Section 4): no citation — an NDA's enforceability is
  // ordinary contract law, no official government source states it.

  // ── business-structures.md ──────────────────────────────────────────────
  {
    id: 's-corp-election',
    file: 'business-structures.md',
    label: 'IRS — S Corporations',
    url: 'https://www.irs.gov/businesses/small-businesses-self-employed/s-corporations',
    // 's corp' (space-separated) dropped for the same reason as 'c corp'
    // below: it false-positive-matches inside unrelated words at a word
    // boundary, e.g. "thi[s corp]oration."
    requiredClaims: [['s-corp']],
  },
  {
    id: 'choose-business-structure',
    file: 'business-structures.md',
    label: 'SBA — Choose a Business Structure',
    url: 'https://www.sba.gov/business-guide/launch-your-business/choose-business-structure',
    // Broad topic-overview page (LLC vs. C-Corp vs. sole prop vs.
    // partnership) — there's no single narrower "claim" to require beyond
    // the topic itself, so one group of alternatives is appropriate.
    // 'c corp' (space-separated, no hyphen) dropped: found via testing to
    // false-positive-match inside unrelated words at a word boundary, e.g.
    // "specifi[c corp]orate" — the hyphenated "c-corp" form (the reference
    // material's own spelling) doesn't have this problem.
    requiredClaims: [['llc', 'c-corp', 'sole proprietorship', 'partnership', 'business structure', 'entity type', 'incorporate']],
  },
  {
    id: 'delaware-incorporation',
    file: 'business-structures.md',
    label: 'Delaware Division of Corporations',
    url: 'https://corp.delaware.gov/',
    // Codex re-review: dropped the old 'venture capital' alternative — an
    // answer can discuss raising VC without ever mentioning Delaware
    // specifically, and citing Delaware's own registry only makes sense
    // if the answer actually names Delaware.
    requiredClaims: [['delaware']],
  },
  {
    id: '83b-election',
    file: 'business-structures.md',
    label: '26 U.S.C. § 83(b) (Cornell Law School, Legal Information Institute)',
    url: 'https://www.law.cornell.edu/uscode/text/26/83',
    // Codex re-review, exact example: requires the election name, the
    // specific 30-day figure, AND the transfer language — not just a bare
    // mention of "83(b)" — so an answer that raises the topic but declines
    // to state the actual deadline earns no citation.
    requiredClaims: [['83(b)', '83b'], ['30 days'], ['transfer', 'transferred']],
  },

  // ── compliance-basics.md ──────────────────────────────────────────────────
  {
    id: 'ein-application-compliance',
    file: 'compliance-basics.md',
    label: 'IRS — Apply for an EIN (Free)',
    url: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online',
    requiredClaims: [['ein']],
  },

  // ── consulting-basics.md ──────────────────────────────────────────────────
  {
    id: 'work-made-for-hire',
    file: 'consulting-basics.md',
    label: '17 U.S.C. § 101 — "Work Made for Hire" (Cornell Law School, Legal Information Institute)',
    url: 'https://www.law.cornell.edu/uscode/text/17/101',
    requiredClaims: [['work for hire', 'work-for-hire']],
  },
  {
    id: 'worker-classification',
    file: 'consulting-basics.md',
    label: 'IRS — Independent Contractor (Self-Employed) or Employee?',
    url: 'https://www.irs.gov/businesses/small-businesses-self-employed/independent-contractor-self-employed-or-employee',
    // These three are near-synonymous phrasings of the SAME claim
    // (contractor-vs-employee classification), so one OR-group is correct
    // here, not three separate AND-required groups.
    requiredClaims: [['worker classification', 'independent contractor', 'misclassif']],
  },

  // ── nonprofit-basics.md ───────────────────────────────────────────────────
  {
    id: 'ein-application-nonprofit',
    file: 'nonprofit-basics.md',
    label: 'IRS — Apply for an EIN (Free)',
    url: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online',
    requiredClaims: [['ein']],
  },
  {
    id: 'form-1023',
    file: 'nonprofit-basics.md',
    label: 'IRS — Application for Recognition of Exemption (Form 1023)',
    url: 'https://www.irs.gov/charities-non-profits/application-for-recognition-of-exemption',
    requiredClaims: [['form 1023', '1023-ez', '501(c)(3)', '501c3']],
  },
  {
    id: 'conflict-of-interest-policy',
    file: 'nonprofit-basics.md',
    label: 'IRS — Instructions for Form 1023 (Appendix A: Sample Conflict of Interest Policy)',
    url: 'https://www.irs.gov/instructions/i1023',
    requiredClaims: [['conflict of interest']],
  },
  {
    id: 'form-990-annual-filing',
    file: 'nonprofit-basics.md',
    label: 'IRS — Annual Filing and Forms (Form 990 Series)',
    url: 'https://www.irs.gov/charities-non-profits/annual-filing-and-forms',
    requiredClaims: [['form 990', '990-n', '990-ez', 'annual report']],
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

// Claim-aware (Codex audit, Med #3, then re-review Med #2): matches against
// the model's final ANSWER text, not the founder's question, AND requires
// every one of a citation's requiredClaims groups to have at least one
// match — not just any single broad topic keyword. The double gate from
// before is unchanged: a citation is only selected if BOTH (a) all of its
// claim groups are satisfied by what the model actually said, AND (b) its
// file is among the files selectReferenceFiles chose as grounding context
// for this turn — so a citation can never be shown for a passage the model
// wasn't actually given, and never for a claim the model didn't actually
// state in full.
// Plain-substring matching false-positives on short, pure-alphanumeric
// terms embedded inside an unrelated longer word — found via testing:
// "ein" (EIN) matched inside "b[ein]g" and "r[ein]state". A word-boundary
// regex fixes this for terms like "ein" without breaking terms that
// contain punctuation or spaces ("83(b)", "s-corp", "trade secret"),
// which are specific enough on their own that a plain substring check is
// fine, and where \b anchoring behaves oddly around trailing punctuation
// like the ")" in "83(b)".
function matchesClaimTerm(lowerText: string, term: string): boolean {
  if (/^[a-z0-9]+$/i.test(term)) {
    return new RegExp(`\\b${term}\\b`, 'i').test(lowerText)
  }
  return lowerText.includes(term)
}

export function selectCitations(referenceFiles: string[], answerText: string): SelectedCitation[] {
  const lower = ` ${answerText.toLowerCase()} `
  const matches = CITATIONS.filter(
    (c) => referenceFiles.includes(c.file) && c.requiredClaims.every((group) => group.some((term) => matchesClaimTerm(lower, term))),
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
