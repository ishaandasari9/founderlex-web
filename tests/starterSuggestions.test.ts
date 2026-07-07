// Regression test for STARTER_SUGGESTIONS (app/starterSuggestions.ts) — the
// shared, jargon-free starter-question list used by both the empty-chat
// Chip buttons and the chat-input autocomplete dropdown in app/page.tsx. A
// total beginner with no idea how to "prompt" an AI relies on this list
// instead of a blank box, so it must never be empty, duplicated, or drift
// between the two call sites (they read the same array, so drift can't
// happen at the code level, but this pins the list's shape so a careless
// edit gets caught). Deliberately imported from its own zero-dependency
// module rather than from app/page.tsx directly — that file is a 'use
// client' page with a large Next/React/browser dependency graph
// (dynamic(), lucide-react, marked, a dozen component modules) that has no
// business being loaded just to read a string array in a plain tsx test.
import { STARTER_SUGGESTIONS } from '../app/starterSuggestions'

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

check(STARTER_SUGGESTIONS.length >= 10, 'has at least 10 starter suggestions (4 original + 6 new)')

check(
  STARTER_SUGGESTIONS.every(s => typeof s === 'string' && s.trim().length > 0),
  'every suggestion is a non-empty string',
)

check(
  new Set(STARTER_SUGGESTIONS).size === STARTER_SUGGESTIONS.length,
  'no duplicate suggestions',
)

// The original 4 chips (app/page.tsx history) must still be present and in
// their original order — the empty-chat screen slices the first 4 off this
// list, so reordering or dropping one would silently change that screen too.
check(
  JSON.stringify(STARTER_SUGGESTIONS.slice(0, 4)) === JSON.stringify([
    'Splitting equity with a co-founder',
    'Hiring my first contractor',
    'Do I need an NDA?',
    'Starting a nonprofit',
  ]),
  'the original 4 starter chips are preserved, in order, as the first 4 entries',
)

// Plain-English check: a first-time founder shouldn't have to already know
// legal vocabulary to recognize a suggestion as relevant to them.
const jargonTerms = ['indemnification', 'tortious', 'force majeure', 'severability', 'estoppel']
check(
  STARTER_SUGGESTIONS.every(s => !jargonTerms.some(term => s.toLowerCase().includes(term))),
  'no suggestion uses raw legal jargon a beginner would not recognize',
)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
