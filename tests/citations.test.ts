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
  check(c.keywords.length > 0, `${c.id}: has at least one keyword`)
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

// ── selectCitations: the double gate (file selected AND keyword match) ────
check(
  selectCitations(['ip-basics.md'], 'How do I trademark my company name?').some((c) => c.url.includes('uspto.gov/trademarks/search')),
  'selects the trademark citation when ip-basics.md is selected and the question mentions trademark',
)
check(
  selectCitations([], 'How do I trademark my company name?').length === 0,
  'REQUIRED: selects no citation when no reference file was selected, even if the question matches a keyword (the file was never actually shown to the model)',
)
check(
  selectCitations(['business-structures.md'], 'How do I trademark my company name?').length === 0,
  'selects no citation when the keyword matches a topic but the FILE that citation belongs to was not selected',
)

// REQUIRED (A3 acceptance test, exact example from the spec): a factual
// answer about the 83(b) 30-day deadline shows a citation to the correct
// source. This mirrors what app/api/chat/route.ts does: selectReferenceFiles
// picks business-structures.md for this question (see
// selectReferences.test.ts's A3 regression), then selectCitations is called
// with that same file list and question.
{
  const referenceFiles = ['business-structures.md']
  const question = 'When is the 83(b) deadline?'
  const citations = selectCitations(referenceFiles, question)
  check(citations.length === 1, 'REQUIRED: the 83(b) deadline question surfaces exactly one citation')
  check(
    citations[0]?.url === 'https://www.law.cornell.edu/uscode/text/26/83',
    `REQUIRED: the 83(b) deadline question cites the correct source (26 U.S.C. § 83) — got: ${citations[0]?.url}`,
  )
}

// ── Unsupported / out-of-scope: no fake citation ────────────────────────────
check(
  selectCitations([], 'What terms should we negotiate in our seed round term sheet?').length === 0,
  'REQUIRED: an out-of-scope-style question with no reference files selected shows no citation',
)
check(
  selectCitations(['contracts-basics.md'], 'What makes a contract legally binding?').length === 0,
  'REQUIRED: a question grounded only in a file with no citation entries (contracts-basics.md, deliberately uncited) shows no citation, never a fabricated one',
)
check(
  selectCitations(['liability-basics.md'], 'Can I lose my LLC liability protection?').length === 0,
  'a question grounded only in liability-basics.md (deliberately uncited, common-law doctrine) shows no citation',
)

// ── Cap and dedupe ───────────────────────────────────────────────────────────
check(
  selectCitations(['nonprofit-basics.md'], 'Do I need an EIN, and should I file Form 1023 or 1023-EZ?').length <= 2,
  'selectCitations never returns more than the cap even when multiple topics are mentioned',
)
{
  // Both compliance-basics.md and nonprofit-basics.md have an EIN citation
  // pointing at the exact same URL — confirm it only shows once.
  const citations = selectCitations(['compliance-basics.md', 'nonprofit-basics.md'], 'Do I need an EIN for my nonprofit?')
  const einUrls = citations.filter((c) => c.url.includes('apply-for-an-employer-identification-number'))
  check(einUrls.length === 1, 'the same URL cited from two different files is deduplicated to one citation')
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
