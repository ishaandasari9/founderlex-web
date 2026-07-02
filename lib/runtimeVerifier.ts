import Anthropic from '@anthropic-ai/sdk'
import { containsLegalTopicKeyword } from './selectReferences'

// A2 runtime verifier (README-v3-trust-and-delivery.md, Part A, A2 — layer 3
// in the defense-in-depth diagram in July9-Focus-Backend-Guardrails-
// IdiotProofing.md). Before any substantive legal answer reaches the user, a
// second, independent model call checks it against the founder's question
// and the reference material it was supposedly grounded in, and returns a
// structured verdict. Routing (implemented in lib/chat.ts, which owns the
// fallback copy and layer ordering): clean -> show it; flagged -> regenerate
// once with the issues fed back; still flagged, or the verifier call itself
// fails -> fall back to a safe response. A flagged answer is never shown.
//
// This module is deliberately split from lib/chat.ts so the routing logic
// (runVerifiedAnswer) and the fail-closed plumbing (resolveVerdict,
// parseVerifierVerdict) can be unit-tested with injected mock model calls,
// without hitting the live Anthropic API or needing to wait out a real
// network timeout.

export interface VerifierVerdict {
  in_scope: boolean
  supported_by_sources: boolean
  contains_forbidden_verdict: boolean
  issues: string[]
}

export function isCleanVerdict(v: VerifierVerdict): boolean {
  return v.in_scope && v.supported_by_sources && !v.contains_forbidden_verdict
}

// The "malformed JSON" collapse point. Using forced tool-use (like
// lib/extractProfile.ts) rather than asking for raw JSON in text means the
// SDK already guarantees syntactically valid JSON for the tool input, but
// the model can still return the wrong shape (missing a field, a string
// instead of a boolean, a non-array issues field) if it doesn't fully
// comply with the schema. This validator is the practical equivalent of a
// JSON.parse failure for that case, and is independently unit-testable with
// no network call at all.
export function parseVerifierVerdict(input: unknown): VerifierVerdict | null {
  if (!input || typeof input !== 'object') return null
  const obj = input as Record<string, unknown>
  if (typeof obj.in_scope !== 'boolean') return null
  if (typeof obj.supported_by_sources !== 'boolean') return null
  if (typeof obj.contains_forbidden_verdict !== 'boolean') return null
  if (!Array.isArray(obj.issues) || !obj.issues.every((i) => typeof i === 'string')) return null
  return {
    in_scope: obj.in_scope,
    supported_by_sources: obj.supported_by_sources,
    contains_forbidden_verdict: obj.contains_forbidden_verdict,
    issues: obj.issues,
  }
}

const DEFAULT_VERIFIER_TIMEOUT_MS = 8000

// Wraps an arbitrary "call the verifier model" function with a timeout, a
// catch-all for thrown/rejected errors, and shape validation — all three
// failure modes (timeout, error, malformed response) collapse to the same
// signal: null, meaning the caller must fall back and must never show the
// draft. timeoutMs is a parameter (not hardcoded) so tests can exercise the
// timeout path in milliseconds instead of waiting out a real 8-second
// network timeout.
export async function resolveVerdict(
  callVerifier: () => Promise<unknown>,
  timeoutMs: number = DEFAULT_VERIFIER_TIMEOUT_MS,
): Promise<VerifierVerdict | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs)
  })

  try {
    const result = await Promise.race([callVerifier().catch(() => null), timeout])
    return parseVerifierVerdict(result)
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export interface RunVerifiedAnswerResult {
  text: string
  // True if the initial draft was not clean (regeneration was attempted),
  // regardless of whether the retry came back clean.
  flagged: boolean
  // True only if neither the initial draft nor the regenerated draft came
  // back clean (or regeneration itself failed) — the safe fallback was used.
  usedFallback: boolean
}

// Pure orchestration of the A2 routing rule, decoupled from the live
// Anthropic client so it can be unit-tested with mock verify/regenerate
// callbacks: clean -> show it; flagged -> regenerate once with the issues
// fed back; still flagged (or verify() fails closed on either attempt) ->
// fall back. A verify() result of null (fail-closed) is treated identically
// to an explicit "flagged" verdict — there is no separate "unknown" state
// that could accidentally let a draft through.
export async function runVerifiedAnswer(params: {
  initialDraft: string
  verify: (draft: string) => Promise<VerifierVerdict | null>
  regenerate: (issues: string[]) => Promise<string>
  fallbackText: string
}): Promise<RunVerifiedAnswerResult> {
  const { initialDraft, verify, regenerate, fallbackText } = params

  const verdict1 = await verify(initialDraft)
  if (verdict1 !== null && isCleanVerdict(verdict1)) {
    return { text: initialDraft, flagged: false, usedFallback: false }
  }

  const issues = verdict1?.issues?.length
    ? verdict1.issues
    : ['The verifier could not confirm this answer was safe to show as written (no usable verdict returned).']

  let retryDraft: string
  try {
    retryDraft = await regenerate(issues)
  } catch {
    return { text: fallbackText, flagged: true, usedFallback: true }
  }

  const verdict2 = await verify(retryDraft)
  if (verdict2 !== null && isCleanVerdict(verdict2)) {
    return { text: retryDraft, flagged: true, usedFallback: false }
  }

  return { text: fallbackText, flagged: true, usedFallback: true }
}

// Skip verification for ordinary conversational filler, to control cost —
// but classified on the ASSISTANT'S DRAFT, never on the user's message.
//
// Codex audit (High): an earlier version gated on the latest USER message
// with an exact-anchored small-talk pattern list. That breaks in a
// multi-turn legal conversation: "Should we form a Delaware C-Corp for
// VC?" -> "Do you want details?" -> "yes" has a user message ("yes") that
// matches a small-talk pattern trivially, but the resulting assistant
// draft is a full substantive legal explanation — which then skipped
// verification entirely. The thing being verified is the ANSWER, so the
// skip decision has to classify the answer, not whatever the user
// happened to type to prompt it.
//
// A draft is treated as small talk only if it is BOTH short AND contains
// no legal-topic vocabulary (containsLegalTopicKeyword, reused from
// lib/selectReferences.ts's TOPIC_RULES rather than a second, driftable
// keyword list). Either signal alone can force verification: a long reply
// is verified regardless of keywords (FORMAT_RULES caps real answers at
// 3-5 sentences, so length alone is a reasonable proxy for substance), and
// a short reply is verified the moment it mentions any topic keyword, so a
// brief-but-real answer like "Yes, a Delaware C-Corp is standard for VC."
// is never skipped just for being brief. False positives here (verifying
// something trivial) just cost a little extra latency/money; false
// negatives (skipping verification on something substantive) are the
// actually dangerous direction, so both signals lean toward verifying.
const SMALL_TALK_DRAFT_MAX_CHARS = 150

export function isSmallTalkDraft(draft: string): boolean {
  const trimmed = draft.trim()
  if (!trimmed) return true
  if (trimmed.length > SMALL_TALK_DRAFT_MAX_CHARS) return false
  return !containsLegalTopicKeyword(trimmed)
}

// ── Aggregate, privacy-safe observability ───────────────────────────────────
// "Log (anonymously, in aggregate) how often it fires" (README-v3 A2). The
// primary mechanism is a structured log line per verified turn — zero
// personal data (no message content, no draft text, no session/user id) —
// which is what actually survives a serverless cold start on Vercel; an
// in-memory counter alone would reset on every cold instance. The counter
// below is a secondary, best-effort convenience for a single warm process
// (e.g. local dev), not the source of truth.
export interface VerifierEvent {
  flagged: boolean
  usedFallback: boolean
}

let runs = 0
let flaggedCount = 0
let fallbackCount = 0

export function logVerifierEvent(event: VerifierEvent): void {
  runs++
  if (event.flagged) flaggedCount++
  if (event.usedFallback) fallbackCount++
  // eslint-disable-next-line no-console
  console.log('[runtime-verifier]', { flagged: event.flagged, usedFallback: event.usedFallback })
}

export function getVerifierStats() {
  return {
    runs,
    flagged: flaggedCount,
    fallback: fallbackCount,
    flaggedRate: runs === 0 ? 0 : flaggedCount / runs,
    fallbackRate: runs === 0 ? 0 : fallbackCount / runs,
  }
}

export function resetVerifierStatsForTests(): void {
  runs = 0
  flaggedCount = 0
  fallbackCount = 0
}

// ── Live model call ──────────────────────────────────────────────────────────
let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

const VERIFIER_SYSTEM_PROMPT = `You are an independent safety and accuracy verifier for FounderLex, an educational legal-basics assistant for first-time student founders. You do not draft answers. You are given one candidate answer, the question it is replying to, and the reference material (if any) it was supposed to be grounded in. Check it and report a structured verdict using the tool provided.

Check for exactly these four things:
- in_scope: true if the question and the answer both stay within FounderLex's educational scope (plain-English startup legal basics: business structure, intellectual property, contracts, liability, compliance, consulting, and nonprofit topics). This includes choosing or explaining a business structure or entity type even when the founder mentions wanting to raise venture capital someday — recommending a Delaware C-Corp because that's what VCs expect is a business-structure question, squarely in scope, NOT a securities/fundraising question. False only if the answer actually gets into the specific TERMS of a deal or dispute: SAFEs, convertible notes, term sheets, cap tables, valuation, negotiating a fundraising round, an active lawsuit or dispute, immigration status, a criminal matter, or a tax-minimization strategy — those should have been refused and referred to a licensed professional instead of substantively answered. Merely mentioning "venture capital" or "investors" as context for a legitimate business-structure or IP question does not make it out of scope.
- supported_by_sources: true if the specific factual claims in the answer (a fee, a deadline, a statutory citation, a percentage or dollar threshold) are consistent with, and don't contradict, the reference material provided — the answer does not need to quote the material verbatim, and reasonable paraphrasing, reorganizing, or a plain-English restatement of what the material says all count as supported. False only if the answer states a specific fact that directly contradicts the reference material, or invents a precise number/statistic with no clear basis in the reference material or well-established general knowledge. Default to true unless there's a genuine, clear contradiction or fabrication — do not flag stylistic differences, added connective context, or a reasonable illustrative example as unsupported. If no reference material was provided, judge this more leniently still — only flag false if the answer states a suspiciously specific fact with no clear general-knowledge basis.
- contains_forbidden_verdict: true if the answer asserts or clearly implies a confident legal-safety verdict, such as "safe to sign," "legally fine," a guaranteed outcome, or that no attorney review is needed. False otherwise. A recommendation TO see a lawyer is not a forbidden verdict.
- issues: a short list of specific, concrete problems you found (empty array if none). Each issue should be one sentence, specific enough that a second attempt could fix it.

Be strict about genuine safety problems (an actual out-of-scope topic being substantively answered, a fact that directly contradicts the source material, or a confident safety verdict) — flag those even if you're not 100% sure. But don't be strict for its own sake: a plain-English, well-organized answer that stays consistent with the reference material and doesn't overstate certainty should come back clean.`

const VERIFIER_TOOL: Anthropic.Tool = {
  name: 'report_verifier_verdict',
  description: 'Report the structured verdict on whether the candidate answer is safe to show to the founder as-is.',
  input_schema: {
    type: 'object',
    properties: {
      in_scope: { type: 'boolean' },
      supported_by_sources: { type: 'boolean' },
      contains_forbidden_verdict: { type: 'boolean' },
      issues: { type: 'array', items: { type: 'string' } },
    },
    required: ['in_scope', 'supported_by_sources', 'contains_forbidden_verdict', 'issues'],
  },
}

function buildVerifierUserContent(question: string, draft: string, referenceContext: string): string {
  const referenceSection = referenceContext
    ? `Reference material the draft answer was supposed to be grounded in:\n${referenceContext}`
    : 'No reference material was provided for this answer (the question did not match any indexed reference file).'

  return [
    `Founder's question: "${question}"`,
    '',
    'Candidate draft answer to check:',
    '"""',
    draft,
    '"""',
    '',
    referenceSection,
  ].join('\n')
}

async function callVerifierModel(question: string, draft: string, referenceContext: string): Promise<unknown> {
  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: VERIFIER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildVerifierUserContent(question, draft, referenceContext) }],
    tools: [VERIFIER_TOOL],
    tool_choice: { type: 'tool', name: 'report_verifier_verdict' },
  })
  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  )
  return toolUse?.input
}

// Public entry point for the live verifier call — fail-closed baked in via
// resolveVerdict, so a caller only ever sees a clean VerifierVerdict or null.
export async function verifyAnswer(
  question: string,
  draft: string,
  referenceContext: string,
): Promise<VerifierVerdict | null> {
  return resolveVerdict(() => callVerifierModel(question, draft, referenceContext))
}
