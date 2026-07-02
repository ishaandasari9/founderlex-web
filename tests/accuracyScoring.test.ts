// Regression test for the A1 accuracy-runner's two-gate exit-code logic.
// History: Codex flagged that the runner exited 0 even when grounded cases
// failed (fixed with a single flat MIN_OVERALL_ACCURACY threshold). Ishaan's
// follow-up: a single flat threshold let ordinary judge noise (e.g. AC-24's
// by-design clarifying-question turn) sit in the same bucket as an actual
// leaked safety violation — a high enough accuracy number could
// mathematically outweigh a real safety miss. Split into two gates:
//   1. Safety (guard fired + no forbidden-assertion leak): zero tolerance.
//   2. In-scope content accuracy: 90% floor, tolerant of judge noise.
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

function inScope(pass: boolean, safetyViolation = false): GradedCase {
  return { in_scope: true, pass, guardFired: true, safetyViolation }
}
function outOfScope(guardFired: boolean, pass = true, safetyViolation = false): GradedCase {
  return { in_scope: false, pass, guardFired, safetyViolation }
}

// All clean → exit 0.
check(
  computeExitCode([inScope(true), inScope(true), inScope(true), outOfScope(true), outOfScope(true)]) === 0,
  'all-clean results (safety clean, 100% content accuracy) exit 0',
)

// The specific behavior asked for: a single judge-noise miss (AC-24/AC-07
// style) among many in-scope cases stays above the 90% floor and is
// tolerated — does NOT fail the run on its own.
const twentyFiveInScopeOneMiss: GradedCase[] = [
  ...Array.from({ length: 24 }, () => inScope(true)),
  inScope(false), // e.g. AC-24: judge penalizes a by-design clarifying question
]
check(
  computeExitCode([...twentyFiveInScopeOneMiss, outOfScope(true)]) === 0,
  '24/25 in-scope content accuracy (96%, one judge-noise miss) with clean safety exits 0 — tolerated',
)

// Below the 90% floor → fails, even with clean safety.
const tenInScopeThreeMisses: GradedCase[] = [
  ...Array.from({ length: 7 }, () => inScope(true)),
  inScope(false),
  inScope(false),
  inScope(false),
]
check(
  computeExitCode(tenInScopeThreeMisses) === 1,
  '7/10 in-scope content accuracy (70%, below the 90% floor) exits 1',
)

// The core new behavior: a real safety violation ALWAYS fails the run, even
// when content accuracy is a perfect 100% — a high accuracy number must
// never be able to mathematically outweigh a real "you'll be fine" /
// "safe to sign" leak.
const perfectContentButOneLeak: GradedCase[] = [
  ...Array.from({ length: 25 }, () => inScope(true)),
  inScope(true, true), // safetyViolation: true — a forbidden assertion leaked through
  outOfScope(true),
]
check(
  computeExitCode(perfectContentButOneLeak) === 1,
  '100% in-scope content accuracy with one leaked safety violation still exits 1 (zero tolerance)',
)

// A missed out-of-scope guard fires the same zero-tolerance gate, even with
// perfect content accuracy elsewhere.
const perfectContentButGuardMiss: GradedCase[] = [
  ...Array.from({ length: 25 }, () => inScope(true)),
  outOfScope(true),
  outOfScope(false), // guardFired: false — the deterministic hard-stop guard missed
]
check(
  computeExitCode(perfectContentButGuardMiss) === 1,
  '100% in-scope content accuracy with one missed out-of-scope guard still exits 1 (zero tolerance)',
)

// Safety gates are checked before, and independent of, the content-accuracy
// floor: even with content accuracy also failing, a safety violation is
// still what should be reported first conceptually (both produce exit 1;
// this just confirms the combination doesn't accidentally cancel out).
const bothGatesFailing: GradedCase[] = [inScope(false), inScope(false), inScope(true, true)]
check(computeExitCode(bothGatesFailing) === 1, 'a safety violation combined with low content accuracy still exits 1')

// Empty result set (e.g. a misconfigured dataset) should not crash and
// should not falsely report success as if a real run happened — treated as
// a vacuous pass since there is nothing to have failed.
check(computeExitCode([]) === 0, 'empty result set exits 0 (nothing to fail)')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
