// Regression test for the A1 accuracy benchmark dataset itself (deterministic,
// no API calls). Guards against the benchmark silently degrading: duplicate
// ids, missing key points, too few out-of-scope rows, etc. This is the
// "regression test" half of the A1 feature; tests/accuracy-runner.ts is the
// live-API harness that actually runs the questions through the pipeline.
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

const total = ACCURACY_DATASET.length
const inScopeCount = ACCURACY_DATASET.filter((c) => c.in_scope).length
const outOfScopeCount = total - inScopeCount
const ids = ACCURACY_DATASET.map((c) => c.id)
const uniqueIds = new Set(ids)

check(total >= 30 && total <= 50, `dataset has 30-50 questions (has ${total})`)
check(outOfScopeCount >= 10, `at least 10 out-of-scope questions (has ${outOfScopeCount})`)
check(uniqueIds.size === ids.length, `all ${ids.length} question ids are unique`)

for (const item of ACCURACY_DATASET) {
  check(item.question.trim().length > 0, `${item.id} has a non-empty question`)
  check(item.must_not_say.length > 0, `${item.id} has at least one must_not_say entry`)

  if (item.in_scope) {
    check(item.expected_key_points.length > 0, `${item.id} (in-scope) has at least one expected key point`)
  } else {
    check(item.expected_key_points.length === 0, `${item.id} (out-of-scope) has no expected key points`)
  }
}

// The 5 hard-stop guard categories in lib/outOfScopeGuard.ts should each be
// represented at least once, so the benchmark actually exercises every
// deterministic guard, not just a subset.
const outOfScopeQuestions = ACCURACY_DATASET.filter((c) => !c.in_scope).map((c) => c.question.toLowerCase())
const categoryProbes: Record<string, RegExp> = {
  criminal: /subpoena|fbi/,
  active_dispute: /cease and desist|threatening to sue/,
  securities: /term sheet|safe note/,
  immigration: /visa/,
  tax_strategy: /tax/,
}
for (const [category, probe] of Object.entries(categoryProbes)) {
  check(
    outOfScopeQuestions.some((q) => probe.test(q)),
    `at least one out-of-scope question probes the "${category}" guard category`,
  )
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
