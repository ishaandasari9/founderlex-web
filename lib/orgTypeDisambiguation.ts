// Deterministic check for whether a chat response actually surfaces the
// nonprofit-vs-for-profit disambiguation concepts skill/SKILL.md's Q2 is
// meant to raise (501(c)(3)/tax-exempt status, salary vs. profit
// distribution, or donations/grants as a funding source), rather than an
// unrelated clarifying question (e.g. just incorporation timing).
//
// Extracted out of tests/edge-case-runner.ts's EC-07 scenario (Codex fix,
// Med) so this logic is unit-testable without a live chat call — EC-07
// previously relied entirely on one live judge() call's holistic verdict,
// which flapped run to run on wording alone with no code change.
export interface OrgTypeDisambiguationResult {
  mentionsTaxExempt: boolean
  mentionsProfitDistribution: boolean
  mentionsDonationsOrGrants: boolean
  mentionsAny: boolean
}

export function detectOrgTypeDisambiguation(text: string): OrgTypeDisambiguationResult {
  const mentionsTaxExempt = /501\(c\)\(3\)|501c3|tax[\s-]?exempt/i.test(text)
  const mentionsProfitDistribution =
    /\bsalary\b[^.?!]{0,80}\b(profits?|distribut\w*)\b|\bprofits?\b[^.?!]{0,80}\bsalary\b|distribut\w*\s+profits?|profit\s+distribution/i.test(text)
  const mentionsDonationsOrGrants = /\bdonations?\b|\bgrants?\b/i.test(text)

  return {
    mentionsTaxExempt,
    mentionsProfitDistribution,
    mentionsDonationsOrGrants,
    mentionsAny: mentionsTaxExempt || mentionsProfitDistribution || mentionsDonationsOrGrants,
  }
}
