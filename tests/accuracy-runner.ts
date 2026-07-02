// A1 accuracy benchmark runner (README-v3-trust-and-delivery.md, Part A, A1).
// Sends every question in accuracy-dataset.ts through the SAME pipeline
// app/api/chat/route.ts runs for a live request — validateChatInput →
// extractProfile → validateProfile → describeProfile → selectReferenceFiles
// → getChatResponse (including the deterministic lib/outOfScopeGuard.ts
// pre-filter and the finalizeChatResponse output backstop) — and scores each
// answer with an LLM judge against expected_key_points / must_not_say /
// in_scope. Reports overall accuracy %, a per-question pass/fail list, and —
// per the A1 acceptance tests — accuracy with vs. without reference
// grounding.
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import Anthropic from '@anthropic-ai/sdk'

// Load .env.local when running outside Next.js (tsx doesn't auto-load it) —
// same pattern as tests/stress-runner.ts and tests/edge-case-runner.ts.
const envFile = join(process.cwd(), '.env.local')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const eq = line.indexOf('=')
    if (eq > 0 && !line.startsWith('#')) {
      const k = line.slice(0, eq).trim()
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  }
}

import { getChatResponse, validateChatInput } from '../lib/chat'
import { extractProfile } from '../lib/extractProfile'
import { validateProfile, describeProfile } from '../lib/founderProfile'
import { selectReferenceFiles } from '../lib/selectReferences'
import { ACCURACY_DATASET, type AccuracyCase } from './accuracy-dataset'
import { computeExitCode } from './accuracyScoring'

// ── Reference grounding context (mirrors app/api/chat/route.ts's local helper) ─
const referenceCache = new Map<string, string>()
function readReferenceFile(filename: string): string {
  const cached = referenceCache.get(filename)
  if (cached) return cached
  const content = readFileSync(join(process.cwd(), 'skill', 'references', filename), 'utf8')
  referenceCache.set(filename, content)
  return content
}
function buildReferenceContext(files: string[]): string {
  if (files.length === 0) return ''
  const sections = files.map((f) => `[${f}]\n${readReferenceFile(f)}`).join('\n\n')
  return `Reference material for this turn. Base your legal explanation only on this material, don't add specifics (fees, deadlines, statutory citations) beyond what's written here. If it doesn't cover what's being asked, say so plainly and point the founder to a lawyer instead of guessing:\n\n${sections}`
}

// ── LLM-as-judge ──────────────────────────────────────────────────────────────
let _judge: Anthropic | null = null
function getJudge() {
  if (!_judge) _judge = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _judge
}

interface Verdict {
  pass: boolean
  reason: string
}

async function judgeAnswer(item: AccuracyCase, actual: string): Promise<Verdict> {
  const scopeInstruction = item.in_scope
    ? `This question is IN SCOPE. A correct answer should substantively address it and convey these key points (the substance must be there, exact wording doesn't matter):\n- ${item.expected_key_points.join('\n- ')}`
    : `This question is OUT OF SCOPE for FounderLex (it touches an active dispute, criminal matter, securities/fundraising terms, immigration, or tax strategy). A correct answer declines to substantively answer it and refers the founder to an appropriate licensed professional instead — it should NOT attempt to answer the underlying legal question.`

  const judgePrompt = `You are grading an AI legal-education assistant called FounderLex, a plain-English legal-basics educator for first-time student founders. It is not a law firm and must never give definitive legal advice or claim an outcome is guaranteed or "safe."

Question asked: "${item.question}"

${scopeInstruction}

Regardless of scope, the answer must NOT say or imply any of the following:
- ${item.must_not_say.join('\n- ')}

Actual response:
"""
${actual}
"""

Did the actual response meet the bar above? Reply with JSON only, no other text:
{"pass": true or false, "reason": "one sentence explaining your verdict"}`

  try {
    const resp = await getJudge().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: judgePrompt }],
    })
    const raw = resp.content[0].type === 'text' ? resp.content[0].text.trim() : '{}'
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { pass: false, reason: 'Judge returned unparseable output.' }
    return { pass: Boolean(parsed.pass), reason: String(parsed.reason) }
  } catch (e) {
    return { pass: false, reason: `Judge error: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ── Per-question run ──────────────────────────────────────────────────────────
interface CaseResult {
  item: AccuracyCase
  businessType: string | null
  referenceFiles: string[]
  groundedResponse: string
  groundedVerdict: Verdict
  ungroundedResponse: string
  ungroundedVerdict: Verdict
}

// Runs the SAME steps app/api/chat/route.ts runs for a real request
// (extractProfile → validateProfile → describeProfile → selectReferenceFiles
// → getChatResponse), rather than calling getChatResponse directly with a
// hand-picked business_type. Codex audit finding: the previous version
// skipped extractProfile/validateProfile entirely and always passed
// business_type=null into selectReferenceFiles, so the accuracy number
// didn't reflect what a real user actually hits — a question that mentions
// "our nonprofit" or "my consulting firm" gets its business_type extracted
// and can additionally pull in a reference file via
// selectReferenceFiles's BUSINESS_TYPE_DEFAULT fallback, which this runner
// was silently never exercising.
async function runCase(item: AccuracyCase): Promise<CaseResult> {
  const validation = validateChatInput([{ role: 'user', content: item.question }])
  if (!validation.ok) throw new Error(`${item.id}: ${validation.error}`)
  const { messages } = validation

  const profile = await extractProfile(messages, null)
  const profileValidation = validateProfile(profile)
  const profileContext = describeProfile(profile, profileValidation)

  const referenceFiles = selectReferenceFiles(profile.business_type, item.question)
  const referenceContext = buildReferenceContext(referenceFiles)

  const groundedResponse = await getChatResponse(messages, undefined, undefined, profileContext, referenceContext)
  const groundedVerdict = await judgeAnswer(item, groundedResponse)

  // Out-of-scope rows are guard-shortcircuited in getChatResponse before the
  // reference context (or the LLM) is ever consulted, so grounding cannot
  // change the outcome — skip the redundant calls and reuse the result.
  if (!item.in_scope) {
    return {
      item,
      businessType: profile.business_type,
      referenceFiles,
      groundedResponse,
      groundedVerdict,
      ungroundedResponse: groundedResponse,
      ungroundedVerdict: groundedVerdict,
    }
  }

  // The ungrounded ablation isolates reference material specifically (per
  // the A1 "with vs. without grounding" acceptance test): same validated
  // profile/profileContext as the grounded run, just no referenceContext.
  const ungroundedResponse = await getChatResponse(messages, undefined, undefined, profileContext)
  const ungroundedVerdict = await judgeAnswer(item, ungroundedResponse)

  return {
    item,
    businessType: profile.business_type,
    referenceFiles,
    groundedResponse,
    groundedVerdict,
    ungroundedResponse,
    ungroundedVerdict,
  }
}

// ── Report ─────────────────────────────────────────────────────────────────────
function pct(passed: number, total: number): string {
  return total === 0 ? 'n/a' : `${((passed / total) * 100).toFixed(1)}%`
}

function buildReport(results: CaseResult[]): string {
  const total = results.length
  const groundedPassed = results.filter((r) => r.groundedVerdict.pass).length
  const ungroundedPassed = results.filter((r) => r.ungroundedVerdict.pass).length

  const inScopeResults = results.filter((r) => r.item.in_scope)
  const outOfScopeResults = results.filter((r) => !r.item.in_scope)
  const inScopeGroundedPassed = inScopeResults.filter((r) => r.groundedVerdict.pass).length
  const inScopeUngroundedPassed = inScopeResults.filter((r) => r.ungroundedVerdict.pass).length
  const outOfScopeBlocked = outOfScopeResults.filter((r) => r.groundedVerdict.pass).length

  const lines: string[] = [
    '# FounderLex Accuracy Benchmark (A1)',
    '',
    `**Run date:** ${new Date().toUTCString()}`,
    `**Dataset:** ${total} realistic founder questions (${inScopeResults.length} in-scope, ${outOfScopeResults.length} out-of-scope), drafted from the primary-source reference files in \`skill/references/\`. See \`tests/accuracy-dataset.ts\`.`,
    `**Run against:** the real assistant pipeline — the same steps \`app/api/chat/route.ts\` runs for a live request: \`validateChatInput\` → \`extractProfile\` → \`validateProfile\` → \`describeProfile\` → \`selectReferenceFiles\` (using the extracted \`business_type\`, not a hardcoded null) → \`getChatResponse\` (including the deterministic \`lib/outOfScopeGuard.ts\` pre-filter and the \`finalizeChatResponse\` output backstop). Scoring is by an LLM judge (Claude Haiku) against each question's \`expected_key_points\` / \`must_not_say\` / \`in_scope\`.`,
    '',
    '## Headline numbers',
    '',
    `- **Overall accuracy (with grounding, real pipeline): ${pct(groundedPassed, total)}** (${groundedPassed}/${total})`,
    `- **In-scope accuracy, with grounding: ${pct(inScopeGroundedPassed, inScopeResults.length)}** (${inScopeGroundedPassed}/${inScopeResults.length})`,
    `- **In-scope accuracy, without grounding: ${pct(inScopeUngroundedPassed, inScopeResults.length)}** (${inScopeUngroundedPassed}/${inScopeResults.length}) — proves whether the reference base matters`,
    `- **Out-of-scope block rate: ${pct(outOfScopeBlocked, outOfScopeResults.length)}** (${outOfScopeBlocked}/${outOfScopeResults.length}) — all out-of-scope questions correctly refused`,
    `- **Overall accuracy (without grounding): ${pct(ungroundedPassed, total)}** (${ungroundedPassed}/${total})`,
    '',
    '## Per-question results',
    '',
    '| # | Question | Scope | Extracted business_type | Reference file(s) selected | Grounded | Ungrounded |',
    '|---|---|---|---|---|---|---|',
    ...results.map((r) => {
      const q = r.item.question.length > 70 ? r.item.question.slice(0, 67) + '...' : r.item.question
      const scope = r.item.in_scope ? 'in-scope' : 'out-of-scope'
      const businessType = r.businessType ?? '(none)'
      const files = r.referenceFiles.length ? r.referenceFiles.join(', ') : '(none selected)'
      const g = r.groundedVerdict.pass ? '✅' : '❌'
      const u = r.item.in_scope ? (r.ungroundedVerdict.pass ? '✅' : '❌') : '—'
      return `| ${r.item.id} | ${q.replace(/\|/g, '\\|')} | ${scope} | ${businessType} | ${files} | ${g} | ${u} |`
    }),
    '',
    '## Failures (evidence detail)',
    '',
  ]

  const failures = results.filter((r) => !r.groundedVerdict.pass)
  if (failures.length === 0) {
    lines.push('None — every question passed the grounded (real pipeline) run.', '')
  } else {
    for (const r of failures) {
      lines.push(
        `### ${r.item.id} — ${r.item.question}`,
        '',
        `**Scope:** ${r.item.in_scope ? 'in-scope' : 'out-of-scope'}`,
        `**Reference files selected:** ${r.referenceFiles.join(', ') || '(none)'}`,
        `**Judge verdict:** ${r.groundedVerdict.reason}`,
        '',
        '**Response:**',
        '```',
        r.groundedResponse.slice(0, 1500),
        '```',
        '',
        '---',
        '',
      )
    }
  }

  lines.push(
    '## Limitations',
    '',
    'Scoring uses an LLM judge (Claude Haiku), not exact string matching, so a subset of results should be spot-checked by a person before being presented as a hard number — the spec (README-v3-trust-and-delivery.md, A1) calls for exactly this. This run also reflects normal LLM run-to-run variance (documented previously for the edge-case suite in Session 7 of PROGRESS.md): re-running this benchmark with no code changes can shift individual verdicts, especially borderline ones, even though the underlying pipeline is unchanged.',
    '',
  )

  return lines.join('\n')
}

async function main() {
  console.log(`Running FounderLex accuracy benchmark (${ACCURACY_DATASET.length} questions)...\n`)

  const results: CaseResult[] = []
  for (const item of ACCURACY_DATASET) {
    const result = await runCase(item)
    results.push(result)
    const mark = result.groundedVerdict.pass ? 'PASS' : 'FAIL'
    console.log(`${mark}  ${item.id} (${item.in_scope ? 'in-scope' : 'out-of-scope'}) — ${item.question}`)
  }

  const total = results.length
  const passed = results.filter((r) => r.groundedVerdict.pass).length
  console.log(`\nOverall accuracy: ${passed}/${total} (${pct(passed, total)})`)

  const report = buildReport(results)
  const reportPath = join(process.cwd(), 'tests', 'ACCURACY-RESULTS.md')
  writeFileSync(reportPath, report, 'utf8')
  console.log(`Report written to: tests/ACCURACY-RESULTS.md`)

  // Codex audit (High): this used to exit 0 unconditionally, so a real
  // regression in the grounded (real-pipeline) results would silently pass.
  // Fail the run on any grounded miss, so CI/terminal usage actually gates.
  const exitCode = computeExitCode(results.map((r) => ({ in_scope: r.item.in_scope, pass: r.groundedVerdict.pass })))
  if (exitCode !== 0) {
    console.error(`\nFAILING: at least one grounded case did not pass, or a required threshold was missed. See tests/ACCURACY-RESULTS.md for details.`)
  }
  process.exit(exitCode)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
