// Regression test for the A1 accuracy-runner exit-code logic (Codex audit,
// High: the runner previously exited 0 even when grounded cases failed).
// Deterministic, no API calls — exercises computeExitCode directly with
// mocked graded-case results.
import { computeExitCode, type GradedCase } from './accuracyScoring'

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

// All cases pass → exit 0.
const allPass: GradedCase[] = [
  { in_scope: true, pass: true },
  { in_scope: true, pass: true },
  { in_scope: false, pass: true },
]
check(computeExitCode(allPass) === 0, 'all-passing results exit 0')

// The core Codex regression: a single failed grounded (in-scope) case must
// fail the run, not be silently swallowed into a passing overall exit code.
const oneGroundedFailure: GradedCase[] = [
  { in_scope: true, pass: true },
  { in_scope: true, pass: false },
  { in_scope: false, pass: true },
]
check(computeExitCode(oneGroundedFailure) === 1, 'a single failed grounded case exits 1 (Codex regression)')

// A failed out-of-scope (guard) case is just as disqualifying — the
// out-of-scope block rate is a hard, zero-tolerance invariant.
const outOfScopeMiss: GradedCase[] = [
  { in_scope: true, pass: true },
  { in_scope: false, pass: false },
]
check(computeExitCode(outOfScopeMiss) === 1, 'a missed out-of-scope block exits 1')

// Multiple failures still just exit 1 (not some other nonzero code).
const multipleFailures: GradedCase[] = [
  { in_scope: true, pass: false },
  { in_scope: true, pass: false },
  { in_scope: false, pass: false },
]
check(computeExitCode(multipleFailures) === 1, 'multiple failures exit 1')

// Empty result set (e.g. a misconfigured dataset) should not falsely report
// success as if a real run happened, but should also not crash — treated as
// a 0/0 vacuous pass here since there is nothing to have failed.
check(computeExitCode([]) === 0, 'empty result set exits 0 (nothing to fail)')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
