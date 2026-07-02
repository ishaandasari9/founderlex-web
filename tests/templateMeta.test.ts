// Regression test for lib/templateMeta.ts (B2 prereq — consolidated out of
// app/page.tsx so it's usable server-side to resolve
// FounderProfile.recommended_documents into template_name keys).
// Deterministic, no API calls.
import { TEMPLATE_LABELS, TEMPLATE_KEYWORDS, detectTemplate } from '../lib/templateMeta'
import { TEMPLATE_FILES } from '../lib/generateDocument'

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

// ── Stays in sync with the 15 templates the generator actually knows about ──
const templateFileKeys = Object.keys(TEMPLATE_FILES).sort()
const labelKeys = Object.keys(TEMPLATE_LABELS).sort()
const keywordKeys = Object.keys(TEMPLATE_KEYWORDS).sort()
check(
  JSON.stringify(labelKeys) === JSON.stringify(templateFileKeys),
  'TEMPLATE_LABELS has exactly one entry per TEMPLATE_FILES key (no drift between the two)',
)
check(
  JSON.stringify(keywordKeys) === JSON.stringify(templateFileKeys),
  'TEMPLATE_KEYWORDS has exactly one entry per TEMPLATE_FILES key (no drift between the two)',
)

// ── detectTemplate: realistic free-text phrasings a chat reply or a
// recommended_documents entry might use ────────────────────────────────────
check(detectTemplate("You'll want a Founders' Agreement to lock in equity.") === 'founders_agreement', 'detects "Founders\' Agreement"')
check(detectTemplate('A Mutual NDA covers this.') === 'mutual_nda', 'detects "Mutual NDA" via "non-disclosure agreement" keyword')
check(detectTemplate('Get a Contractor Agreement in place.') === 'contractor_agreement', 'detects "Contractor Agreement"')
check(detectTemplate('You need Articles of Incorporation first.') === 'nonprofit_articles', 'detects "Articles of Incorporation"')
check(detectTemplate('A Statement of Work locks in scope.') === 'sow_template', 'detects "Statement of Work"')
check(detectTemplate('This is just small talk, nothing document-related.') === null, 'returns null for text mentioning no known template')
check(detectTemplate('') === null, 'returns null for an empty string')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
