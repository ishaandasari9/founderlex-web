// Regression test for the A3 citation routing decision: whether a chat
// response is a genuine, citable answer vs. a canned safe response
// (out-of-scope guard refusal, or either A2/layer-4 safety fallback), and
// how that combines with lib/citations.ts's selectCitations. Deterministic,
// no API calls.
import { isCannedSafeResponse, CHAT_SAFE_FALLBACK, VERIFIER_SAFE_FALLBACK } from '../lib/chat'
import { GUARD_CATEGORIES } from '../lib/outOfScopeGuard'
import { selectCitations } from '../lib/citations'

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

// ── isCannedSafeResponse ─────────────────────────────────────────────────────
check(isCannedSafeResponse(CHAT_SAFE_FALLBACK) === true, 'flags the layer-4 forbidden-assertion fallback')
check(isCannedSafeResponse(VERIFIER_SAFE_FALLBACK) === true, 'flags the A2 verifier fallback')
for (const category of GUARD_CATEGORIES) {
  check(isCannedSafeResponse(category.response) === true, `flags the "${category.id}" out-of-scope guard response`)
}
check(
  isCannedSafeResponse('An LLC creates a legal wall between the business and your personal assets.') === false,
  'does not flag an ordinary, genuine answer',
)
check(isCannedSafeResponse('') === false, 'does not flag an empty string as canned (not a real fallback match)')

// ── REQUIRED (A3 acceptance test): the route-level composition — a
// fallback/guard response must never carry a citation, even when the
// reference files that would normally justify one were selected for the
// turn. This mirrors exactly what app/api/chat/route.ts does: citations
// are computed only when the response text isn't a canned safe response,
// and selectCitations is called with that SAME final text (claim-aware,
// Codex audit Med #3 — not the question). ─────────────────────────────────
function citationsForResponse(text: string, referenceFiles: string[]) {
  return isCannedSafeResponse(text) ? [] : selectCitations(referenceFiles, text)
}

check(
  citationsForResponse(VERIFIER_SAFE_FALLBACK, ['business-structures.md']).length === 0,
  'REQUIRED: an A2 verifier fallback shows no citation, even though the reference files would otherwise have earned one',
)
check(
  citationsForResponse(CHAT_SAFE_FALLBACK, ['ip-basics.md']).length === 0,
  'REQUIRED: a layer-4 forbidden-assertion fallback shows no citation, even though the reference files would otherwise have earned one',
)
check(
  citationsForResponse(GUARD_CATEGORIES[0].response, ['business-structures.md']).length === 0,
  'REQUIRED: an out-of-scope guard refusal shows no citation',
)
check(
  citationsForResponse(
    'Any 83(b) election needs to be filed within 30 days after the stock is transferred, so do not wait.',
    ['business-structures.md'],
  ).length === 1,
  'a genuine answer (not a canned response) that states the claim still earns its citation',
)
check(
  citationsForResponse("I don't have that in my notes; ask a lawyer.", ['business-structures.md']).length === 0,
  'REQUIRED (Codex, claim-aware): a genuine (non-canned) answer that declines to state the claim earns no citation, even with the right reference file selected',
)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
