// Pure, side-effect-free scoring helpers for the A1 accuracy benchmark.
// Split out of accuracy-runner.ts (which runs main() at the top level and
// hits the live API) so this logic can be imported and unit-tested without
// triggering a real benchmark run.

export interface GradedCase {
  in_scope: boolean
  pass: boolean
}

// Codex audit finding (High): the runner previously always exited 0, even
// when grounded cases failed their judge verdict — a CI/terminal run could
// silently "pass" with real regressions. Zero tolerance by default: this is
// a small, hand-curated dataset where every case is expected to hold, not a
// large noisy sample where a couple of misses are acceptable. Lower this if
// the dataset grows large enough that a small amount of LLM-judge variance
// needs to be tolerated without red-flagging every run.
export const MIN_OVERALL_ACCURACY = 1

// The out-of-scope block rate is a distinct, safety-critical invariant from
// overall accuracy: it must never miss, even if a future change to
// MIN_OVERALL_ACCURACY tolerates some in-scope noise.
export const REQUIRED_OUT_OF_SCOPE_BLOCK_RATE = 1

export function computeExitCode(results: GradedCase[]): number {
  if (results.length === 0) return 0

  const anyGroundedFailure = results.some((r) => !r.pass)

  const outOfScope = results.filter((r) => !r.in_scope)
  const blockRate = outOfScope.length === 0
    ? 1
    : outOfScope.filter((r) => r.pass).length / outOfScope.length

  const overallAccuracy = results.filter((r) => r.pass).length / results.length

  if (blockRate < REQUIRED_OUT_OF_SCOPE_BLOCK_RATE) return 1
  if (overallAccuracy < MIN_OVERALL_ACCURACY) return 1
  if (anyGroundedFailure) return 1

  return 0
}
