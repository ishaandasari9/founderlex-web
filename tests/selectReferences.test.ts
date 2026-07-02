// Regression test for lib/selectReferences.ts (Codex audit, Med #3): the A1
// accuracy benchmark found 5 in-scope questions (AC-03, AC-08, AC-10, AC-19,
// AC-25) that selected no reference file, or the wrong one, so the model
// answered ungrounded even though a relevant primary-source file existed.
// Deterministic, no API calls — asserts every in-scope case in
// accuracy-dataset.ts actually selects its expected_reference_file, using
// the same business_type=null starting condition a fresh conversation has.
import { selectReferenceFiles } from '../lib/selectReferences'
import { ACCURACY_DATASET } from './accuracy-dataset'

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

const inScopeWithExpectedFile = ACCURACY_DATASET.filter((c) => c.in_scope && c.expected_reference_file)
check(inScopeWithExpectedFile.length > 0, 'dataset has in-scope cases with an expected_reference_file to check')

for (const item of inScopeWithExpectedFile) {
  const selected = selectReferenceFiles(null, item.question)
  check(
    selected.includes(item.expected_reference_file as string),
    `${item.id} selects ${item.expected_reference_file} for "${item.question}" (got: [${selected.join(', ') || 'none'}])`,
  )
}

// Explicit regressions for the exact 5 questions Codex's audit flagged as
// broken, so a future keyword refactor that accidentally reverts one of
// these fails loudly and specifically, not just as part of the loop above.
const codexFlaggedIds = ['AC-03', 'AC-08', 'AC-10', 'AC-19', 'AC-25']
for (const id of codexFlaggedIds) {
  const item = ACCURACY_DATASET.find((c) => c.id === id)
  check(Boolean(item), `${id} still exists in the dataset`)
  if (!item) continue
  const selected = selectReferenceFiles(null, item.question)
  check(
    selected.includes(item.expected_reference_file as string),
    `REGRESSION (Codex): ${id} now grounds correctly in ${item.expected_reference_file}`,
  )
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
