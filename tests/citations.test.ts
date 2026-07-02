// Regression test for lib/citations.ts (A3, README-v3-trust-and-delivery.md
// Part A). Deterministic, no API calls, no network access — checks URL
// well-formedness/domain-allowlist offline (every URL was separately
// verified live, by hand, before being added to CITATIONS).
import { CITATIONS, isOfficialCitationUrl, selectCitations } from '../lib/citations'

let checks = 0
let failures = 0

function check(condition: boolean, message: string) {
  checks++
  if (condition) {
    console.log(`PASS  ${message}`)
  } else {
    console.log(`FAIL  ${message}`)
    failures++
  }
}

// ── "Every citation URL is a real official page" (A3 acceptance test) ──────
// Deterministic proxy for "real official page": https + an allow-listed
// official government/legal-institution domain. Live reachability of every
// URL below was checked by hand with WebFetch before this file was
// committed (see lib/citations.ts's header comment).
check(CITATIONS.length >= 10, `CITATIONS has a meaningful number of entries (has ${CITATIONS.length})`)

for (const c of CITATIONS) {
  check(isOfficialCitationUrl(c.url), `${c.id}: url is an official https URL on an allow-listed domain (${c.url})`)
  check(c.label.trim().length > 0, `${c.id}: has a non-empty label`)
  check(c.requiredClaims.length > 0, `${c.id}: has at least one required claim group`)
  check(c.requiredClaims.every((g) => g.length > 0), `${c.id}: no required claim group is empty`)
  check(c.file.endsWith('.md'), `${c.id}: file field looks like a reference filename (${c.file})`)
}

const ids = CITATIONS.map((c) => c.id)
check(new Set(ids).size === ids.length, 'all citation ids are unique')

// ── isOfficialCitationUrl: rejects non-official / malformed URLs ──────────
check(isOfficialCitationUrl('https://www.irs.gov/some-page') === true, 'accepts a real irs.gov URL')
check(isOfficialCitationUrl('https://www.uspto.gov/x') === true, 'accepts a real uspto.gov URL')
check(isOfficialCitationUrl('http://www.irs.gov/some-page') === false, 'rejects http (non-https) even on an official domain')
check(isOfficialCitationUrl('https://irs.gov.evil.com/phish') === false, 'rejects a lookalike domain that merely contains "irs.gov"')
check(isOfficialCitationUrl('https://not-a-real-gov-site.com') === false, 'rejects a domain not on the allowlist')
check(isOfficialCitationUrl('not a url at all') === false, 'rejects a malformed string')

// ── selectCitations: claim-aware (Codex audit, Med #3) — matched against
// the ANSWER text, not the question, plus the pre-existing double gate
// (file selected AND keyword match) ─────────────────────────────────────────
check(
  selectCitations(
    ['ip-basics.md'],
    'First, search the USPTO trademark database to make sure the name is clear, then file to register it.',
  ).some((c) => c.url.includes('uspto.gov/trademarks/search')),
  'selects the trademark citation when ip-basics.md is selected and the ANSWER mentions trademark',
)
check(
  selectCitations([], 'You should search the USPTO trademark database before filing.').length === 0,
  'REQUIRED: selects no citation when no reference file was selected, even if the answer matches a keyword (the file was never actually shown to the model)',
)
check(
  selectCitations(['business-structures.md'], 'You should search the USPTO trademark database before filing.').length === 0,
  'selects no citation when the keyword matches a topic but the FILE that citation belongs to was not selected',
)

// REQUIRED (A3 acceptance test, exact example from the spec): a factual
// answer about the 83(b) 30-day deadline shows a citation to the correct
// source. This mirrors what app/api/chat/route.ts does: selectReferenceFiles
// picks business-structures.md for this question (see
// selectReferences.test.ts's A3 regression), then selectCitations is called
// with the SAME file list and the model's actual final answer text.
{
  const referenceFiles = ['business-structures.md']
  const answer = 'The 83(b) election must be filed within 30 days after the restricted stock is transferred.'
  const citations = selectCitations(referenceFiles, answer)
  check(citations.length === 1, 'REQUIRED: an answer stating the 83(b) deadline surfaces exactly one citation')
  check(
    citations[0]?.url === 'https://www.law.cornell.edu/uscode/text/26/83',
    `REQUIRED: the 83(b) answer cites the correct source (26 U.S.C. § 83) — got: ${citations[0]?.url}`,
  )
}

// REQUIRED (Codex audit, Med #3, exact scenario): the question raises 83(b)
// and the file is selected as grounding, but the model's actual answer
// declines to state the claim at all — no citation, because the answer
// never used it.
{
  const referenceFiles = ['business-structures.md']
  const answer = "I don't have that in my notes; ask a lawyer."
  const citations = selectCitations(referenceFiles, answer)
  check(
    citations.length === 0,
    `REQUIRED (Codex): a declined/non-answer earns no citation even though referenceFiles/the question would have — got: ${JSON.stringify(citations)}`,
  )
}

// REQUIRED (Codex re-review, Med #2, exact scenario): claim-aware citations
// are not just topic-aware. This answer DOES mention "83(b)" — under the
// old flat-keyword logic that alone would have earned the citation — but
// never states the 30-day figure or the transfer language, so the specific
// claim the Cornell citation supports was never actually made.
{
  const referenceFiles = ['business-structures.md']
  const answer = "Ask a lawyer about the 83(b) election timing; I don't have the deadline."
  const citations = selectCitations(referenceFiles, answer)
  check(
    citations.length === 0,
    `REQUIRED (Codex re-review): mentioning "83(b)" alone, without the 30-day figure or transfer language, earns no citation — got: ${JSON.stringify(citations)}`,
  )
}

// Sanity: each required claim GROUP must independently gate the citation —
// missing any one of the three still blocks it.
check(
  selectCitations(['business-structures.md'], 'The 83(b) election has a deadline, but check with a lawyer for the exact number of days.').length === 0,
  'mentioning "83(b)" and "deadline" without "30 days" still earns no citation',
)
check(
  selectCitations(['business-structures.md'], 'You generally have 30 days to file an election after receiving stock, ask a lawyer which one applies.').length === 0,
  'mentioning "30 days" without ever naming "83(b)" still earns no citation (could be a different 30-day deadline entirely)',
)

// Sanity: the Delaware citation no longer fires on "venture capital" alone
// (Codex re-review) — only when Delaware is actually named.
check(
  selectCitations(['business-structures.md'], 'For venture capital, investors will expect a specific corporate structure.').length === 0,
  'REQUIRED (Codex re-review): "venture capital" alone no longer triggers the Delaware-specific citation',
)
check(
  selectCitations(['business-structures.md'], 'For venture capital, a Delaware C-Corp is the standard structure investors expect.').some((c) => c.url === 'https://corp.delaware.gov/'),
  'the Delaware citation still fires once Delaware is actually named',
)

// ── Unsupported / out-of-scope: no fake citation ────────────────────────────
check(
  selectCitations([], "Securities and fundraising terms are outside what I can safely help with. Please talk to a startup attorney.").length === 0,
  'REQUIRED: an out-of-scope-style refusal with no reference files selected shows no citation',
)
check(
  selectCitations(['contracts-basics.md'], 'A contract needs offer, acceptance, and consideration to be legally binding.').length === 0,
  'REQUIRED: an answer grounded only in a file with no citation entries (contracts-basics.md, deliberately uncited) shows no citation, never a fabricated one',
)
check(
  selectCitations(['liability-basics.md'], 'You can lose your LLC liability protection by mixing personal and business funds.').length === 0,
  'an answer grounded only in liability-basics.md (deliberately uncited, common-law doctrine) shows no citation',
)

// ── Word-boundary matching for short plain-alphanumeric terms (found via
// testing while building the requiredClaims predicates) ──────────────────
check(
  selectCitations(['compliance-basics.md'], 'Your paperwork is being processed by the state right now.').length === 0,
  'REQUIRED: "being" does not false-positive match the "ein" (EIN) claim term',
)
check(
  selectCitations(['compliance-basics.md'], "Don't forget to reinstate your registration before the deadline.").length === 0,
  '"reinstate" does not false-positive match the "ein" (EIN) claim term either',
)
check(
  selectCitations(['compliance-basics.md'], 'You can get an EIN for free directly from the IRS.').some((c) => c.url.includes('apply-for-an-employer-identification-number')),
  'a genuine mention of "EIN" still matches correctly with word-boundary matching in place',
)
check(
  selectCitations(['compliance-basics.md'], 'You can get an EIN, which is free, directly from the IRS.').some((c) => c.url.includes('apply-for-an-employer-identification-number')),
  '"EIN" immediately followed by a comma still matches (word-boundary, not whitespace-only)',
)

// ── Cap and dedupe ───────────────────────────────────────────────────────────
check(
  selectCitations(
    ['nonprofit-basics.md'],
    'You need an EIN first, then decide between Form 1023 and Form 1023-EZ based on your projected receipts.',
  ).length <= 2,
  'selectCitations never returns more than the cap even when multiple topics are mentioned',
)
{
  // Both compliance-basics.md and nonprofit-basics.md have an EIN citation
  // pointing at the exact same URL — confirm it only shows once.
  const citations = selectCitations(
    ['compliance-basics.md', 'nonprofit-basics.md'],
    'You can get an EIN for free directly from the IRS in about ten minutes.',
  )
  const einUrls = citations.filter((c) => c.url.includes('apply-for-an-employer-identification-number'))
  check(einUrls.length === 1, 'the same URL cited from two different files is deduplicated to one citation')
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
