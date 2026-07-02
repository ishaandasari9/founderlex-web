// Regression test for lib/orgTypeDisambiguation.ts (Codex fix, Med, on B2
// review). Fully deterministic — no API calls. This is the logic
// tests/edge-case-runner.ts's EC-07 scenario now uses as its pass
// criterion instead of a single live judge() call, since that judge call
// flapped run to run on wording alone with no code change.
import { detectOrgTypeDisambiguation } from '../lib/orgTypeDisambiguation'

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

function main() {
  check(
    detectOrgTypeDisambiguation(
      'Are you planning to apply for 501(c)(3) tax-exempt status, or would you rather take a salary and keep any profits?',
    ).mentionsAny,
    'detects 501(c)(3) + tax-exempt phrasing',
  )
  check(
    detectOrgTypeDisambiguation(
      'This could be structured as a nonprofit relying on donations and grants, or as a for-profit business.',
    ).mentionsAny,
    'detects donations/grants phrasing',
  )
  check(
    detectOrgTypeDisambiguation(
      'Do you want to take a salary, or would this run more like a cause where profits stay in the org?',
    ).mentionsAny,
    'detects salary-vs-profit phrasing even with words in between',
  )
  check(
    detectOrgTypeDisambiguation(
      'Would you rather distribute profits to founders, or keep the mission-driven, cause-based structure?',
    ).mentionsAny,
    'detects "distribute profits" phrasing',
  )

  // REQUIRED: the actual response text that caused Codex's EC-07 finding
  // (from tests/EDGE-CASE-RESULTS.md) correctly still fails this check — it
  // asks about incorporation timing, not any nonprofit-vs-for-profit
  // disambiguation concept. Proves this is a real, still-enforced check, not
  // one loosened just to make EC-07 pass.
  check(
    !detectOrgTypeDisambiguation(
      "That sounds like a really meaningful project. Before I point you toward the right structure and documents, one quick question: are you planning to incorporate this as a formal organization right away, or are you still in the \"figuring out if this will work\" phase and want to stay lean for now?",
    ).mentionsAny,
    'REQUIRED: an off-topic clarifying question (incorporation timing, not org type) is correctly NOT flagged as disambiguation',
  )

  check(
    !detectOrgTypeDisambiguation('Tell me more about what problem you are trying to solve.').mentionsAny,
    'a generic follow-up with none of the three concepts is correctly not flagged',
  )

  const result = detectOrgTypeDisambiguation('We want tax-exempt status and plan to apply for grants too.')
  check(result.mentionsTaxExempt, 'mentionsTaxExempt is set independently')
  check(result.mentionsDonationsOrGrants, 'mentionsDonationsOrGrants is set independently')
  check(!result.mentionsProfitDistribution, 'mentionsProfitDistribution is false when not present')

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
  if (failures > 0) process.exit(1)
}

main()
