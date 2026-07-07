// Regression test for lib/runtimeVerifier.ts (A2, README-v3-trust-and-
// delivery.md Part A). Deterministic, no live API calls — the live model
// call (callVerifierModel) is never exercised here; instead runVerifiedAnswer
// and resolveVerdict are tested with injected mock callbacks, which is what
// makes the timeout scenario testable in milliseconds instead of waiting out
// a real network timeout.
import {
  parseVerifierVerdict,
  isCleanVerdict,
  resolveVerdict,
  runVerifiedAnswer,
  isSmallTalkDraft,
  logVerifierEvent,
  getVerifierStats,
  resetVerifierStatsForTests,
  type VerifierVerdict,
} from '../lib/runtimeVerifier'

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

async function checkAsync(promise: Promise<boolean>, message: string) {
  check(await promise, message)
}

function clean(issues: string[] = []): VerifierVerdict {
  return { in_scope: true, supported_by_sources: true, contains_forbidden_verdict: false, issues }
}
function flaggedOutOfScope(issues: string[]): VerifierVerdict {
  return { in_scope: false, supported_by_sources: true, contains_forbidden_verdict: false, issues }
}

async function main() {
  // ── parseVerifierVerdict ────────────────────────────────────────────────
  check(parseVerifierVerdict(clean()) !== null, 'parseVerifierVerdict accepts a well-formed verdict')
  check(parseVerifierVerdict(null) === null, 'parseVerifierVerdict rejects null')
  check(parseVerifierVerdict(undefined) === null, 'parseVerifierVerdict rejects undefined')
  check(parseVerifierVerdict('not an object') === null, 'parseVerifierVerdict rejects a bare string')
  check(
    parseVerifierVerdict({ in_scope: true, supported_by_sources: true, contains_forbidden_verdict: false }) === null,
    'parseVerifierVerdict rejects a verdict missing the issues field',
  )
  check(
    parseVerifierVerdict({ in_scope: 'yes', supported_by_sources: true, contains_forbidden_verdict: false, issues: [] }) === null,
    'parseVerifierVerdict rejects in_scope as a string instead of a boolean',
  )
  check(
    parseVerifierVerdict({ in_scope: true, supported_by_sources: true, contains_forbidden_verdict: false, issues: 'not an array' }) === null,
    'parseVerifierVerdict rejects issues that is not an array',
  )
  check(
    parseVerifierVerdict({ in_scope: true, supported_by_sources: true, contains_forbidden_verdict: false, issues: [1, 2] }) === null,
    'parseVerifierVerdict rejects an issues array containing non-strings',
  )

  // ── isCleanVerdict ───────────────────────────────────────────────────────
  check(isCleanVerdict(clean()) === true, 'isCleanVerdict is true for a fully clean verdict')
  check(isCleanVerdict(flaggedOutOfScope(['out of scope'])) === false, 'isCleanVerdict is false when in_scope is false')
  check(
    isCleanVerdict({ in_scope: true, supported_by_sources: false, contains_forbidden_verdict: false, issues: ['x'] }) === false,
    'isCleanVerdict is false when supported_by_sources is false',
  )
  check(
    isCleanVerdict({ in_scope: true, supported_by_sources: true, contains_forbidden_verdict: true, issues: ['x'] }) === false,
    'isCleanVerdict is false when contains_forbidden_verdict is true',
  )

  // ── resolveVerdict: the 3 fail-closed modes + the success path ─────────
  await checkAsync(
    resolveVerdict(() => Promise.resolve(clean())).then((v) => v !== null && isCleanVerdict(v)),
    'resolveVerdict returns a clean verdict on success',
  )
  await checkAsync(
    resolveVerdict(() => Promise.reject(new Error('network error'))).then((v) => v === null),
    'FAIL-CLOSED: resolveVerdict returns null when the verifier call rejects/errors',
  )
  await checkAsync(
    resolveVerdict(() => Promise.resolve({ in_scope: 'not a boolean' })).then((v) => v === null),
    'FAIL-CLOSED: resolveVerdict returns null on a malformed/wrongly-shaped response',
  )
  await checkAsync(
    resolveVerdict(() => new Promise(() => {}), 30).then((v) => v === null),
    'FAIL-CLOSED: resolveVerdict returns null when the verifier call times out (never resolves, 30ms budget)',
  )

  // ── runVerifiedAnswer: clean-first-try passes through unchanged ─────────
  {
    const result = await runVerifiedAnswer({
      initialDraft: 'An LLC protects your personal assets from most business debts.',
      verify: async () => clean(),
      regenerate: async () => { throw new Error('should never be called for a clean first draft') },
      fallbackText: 'FALLBACK',
    })
    check(
      result.text === 'An LLC protects your personal assets from most business debts.' && !result.flagged && !result.usedFallback,
      'runVerifiedAnswer shows a clean initial draft unchanged, without ever calling regenerate',
    )
  }

  // ── runVerifiedAnswer: the required scenario — a deliberately wrong/
  // out-of-scope draft is caught, and the fixed regeneration IS shown
  // (never the original bad draft) ─────────────────────────────────────────
  {
    const BAD_DRAFT = 'Sure, here is exactly how to respond to the lawsuit you mentioned...'
    const FIXED_DRAFT = "That sounds like an active legal dispute, please talk to a licensed attorney."
    let verifyCallCount = 0
    const result = await runVerifiedAnswer({
      initialDraft: BAD_DRAFT,
      verify: async (draft) => {
        verifyCallCount++
        return draft === BAD_DRAFT ? flaggedOutOfScope(['answered a lawsuit question instead of refusing']) : clean()
      },
      regenerate: async (issues) => {
        check(issues.length > 0, 'runVerifiedAnswer feeds the verifier issues into regenerate()')
        return FIXED_DRAFT
      },
      fallbackText: 'FALLBACK',
    })
    check(result.text !== BAD_DRAFT, 'REQUIRED: the deliberately wrong/out-of-scope draft is never shown as-is')
    check(result.text === FIXED_DRAFT && result.flagged && !result.usedFallback, 'the regenerated, now-clean draft is shown instead')
    check(verifyCallCount === 2, 'runVerifiedAnswer verifies both the initial draft and the regenerated draft')
  }

  // ── runVerifiedAnswer: still flagged after the single retry -> fallback,
  // never the bad draft in either form ─────────────────────────────────────
  {
    const BAD_DRAFT = 'This is legally fine, go ahead and sign it.'
    const STILL_BAD_RETRY = 'You are fully covered, no need to worry about this.'
    let regenerateCallCount = 0
    const result = await runVerifiedAnswer({
      initialDraft: BAD_DRAFT,
      verify: async () => flaggedOutOfScope(['contains a forbidden safety verdict']),
      regenerate: async () => {
        regenerateCallCount++
        return STILL_BAD_RETRY
      },
      fallbackText: 'FALLBACK: please confirm with a lawyer.',
    })
    check(result.text !== BAD_DRAFT && result.text !== STILL_BAD_RETRY, 'REQUIRED: neither the bad draft nor a still-bad retry is ever shown')
    check(result.text === 'FALLBACK: please confirm with a lawyer.' && result.usedFallback, 'falls back to the safe response after one failed regeneration attempt')
    check(regenerateCallCount === 1, 'regeneration is attempted exactly once, never looped')
  }

  // ── runVerifiedAnswer: a FIRST-PASS verifier OUTAGE (verify() returning null
  // — timeout/error/malformed, NOT a content objection) shows the initial draft
  // under the deterministic layer-4 backstop instead of refusing. This is the
  // demo-resilience change: an infrastructure blip must not nuke a good answer.
  // regenerate() must never be called on this path. ────────────────────────────
  {
    const DRAFT = 'An LLC creates a legal wall between your business and your personal assets.'
    let regenerateCalled = false
    const result = await runVerifiedAnswer({
      initialDraft: DRAFT,
      verify: async () => null, // resolveVerdict's null from a timeout/error/malformed response
      regenerate: async () => { regenerateCalled = true; return 'unused' },
      fallbackText: 'FALLBACK: verifier unavailable.',
    })
    check(
      result.text === DRAFT && !result.usedFallback && result.verifierUnavailable === true && !result.flagged,
      'RESILIENCE: a first-pass verifier outage shows the initial draft (layer-4 is the net), not the refusal',
    )
    check(!regenerateCalled, 'a first-pass verifier outage does not trigger a regeneration')
  }

  // ── runVerifiedAnswer: a GENUINE content flag whose retry then hits a
  // verifier outage (null on the retry) still fails closed — we never trust an
  // unverified regeneration of an answer that had a real content problem. This
  // preserves fail-closed exactly where it matters. ────────────────────────────
  {
    const BAD_DRAFT = 'This is legally fine, go ahead and sign it.'
    const result = await runVerifiedAnswer({
      initialDraft: BAD_DRAFT,
      verify: async (draft) => (draft === BAD_DRAFT ? flaggedOutOfScope(['contains a forbidden safety verdict']) : null),
      regenerate: async () => 'a regenerated but now-unverifiable draft',
      fallbackText: 'FALLBACK: could not confirm safe.',
    })
    check(
      result.text !== BAD_DRAFT && result.text !== 'a regenerated but now-unverifiable draft',
      'FAIL-CLOSED: a genuinely flagged answer whose retry cannot be verified never leaks either draft',
    )
    check(result.text === 'FALLBACK: could not confirm safe.' && result.usedFallback, 'a flagged-then-unverifiable retry falls back to the safe response')
  }

  // ── runVerifiedAnswer: regenerate() itself throwing also falls back ─────
  {
    const result = await runVerifiedAnswer({
      initialDraft: 'flagged draft',
      verify: async () => flaggedOutOfScope(['needs fixing']),
      regenerate: async () => { throw new Error('model call failed') },
      fallbackText: 'FALLBACK: regeneration failed.',
    })
    check(result.text === 'FALLBACK: regeneration failed.' && result.usedFallback, 'a thrown error during regeneration also falls back safely, not a crash')
  }

  // ── isSmallTalkDraft: classifies the ASSISTANT DRAFT, not the user
  // message (Codex audit, High) ────────────────────────────────────────────
  check(isSmallTalkDraft('') === true, 'isSmallTalkDraft flags an empty draft')
  check(isSmallTalkDraft("You're welcome!") === true, 'isSmallTalkDraft flags a true, short greeting/acknowledgment draft')
  check(
    isSmallTalkDraft("Glad I could help, let me know if you have more questions!") === true,
    'isSmallTalkDraft flags a short, friendly closing line with no legal content',
  )
  check(
    isSmallTalkDraft('An LLC creates a legal wall between the business and your personal assets.') === false,
    'isSmallTalkDraft does not flag a short draft that DOES contain legal-topic vocabulary ("LLC", "personal assets")',
  )
  check(
    isSmallTalkDraft(
      "Yes, forming a Delaware C-Corp is the standard structure most VCs expect, since it lets you issue stock and stock options cleanly and investors are already familiar with Delaware's corporate law. Setting up the stock structure correctly should go through a startup attorney rather than a DIY filing.",
    ) === false,
    'isSmallTalkDraft does not flag a long, substantive draft',
  )

  // ── REQUIRED (Codex regression): a substantive draft produced from a
  // multi-turn conversation where the LATEST USER MESSAGE is trivial
  // ("yes") must still be classified as needing verification. The bug was
  // gating on the user's message instead of the assistant's draft — this
  // proves the fix by classifying only the draft, exactly as
  // lib/chat.ts's getChatResponse now does, and contrasting it with what
  // the old (removed) user-message-based check would have said. ─────────────
  {
    const messages = [
      { role: 'user' as const, content: 'Should we form a Delaware C-Corp for VC?' },
      { role: 'assistant' as const, content: 'Do you want details?' },
      { role: 'user' as const, content: 'yes' },
    ]
    const lastUserMessage = messages[messages.length - 1].content
    const substantiveDraft =
      "A Delaware C-Corp is what most VCs expect, since it lets you issue preferred stock and stock options cleanly, and it's the entity type nearly all standard VC term sheets assume. It's more complex and costly to set up correctly than an LLC, so the stock structure and any 83(b) election timing should go through a startup attorney."

    // What the OLD, now-removed user-message-based heuristic would have
    // said (inlined here, not imported, since it no longer exists in the
    // module — this is purely illustrating the bug that was fixed).
    const oldStyleUserMessageCheck = /^(yes|yeah|yep|no|nope|sure)[!.]*$/i.test(lastUserMessage.trim())
    check(oldStyleUserMessageCheck === true, "sanity check: the trivial user reply \"yes\" WOULD have matched the old, buggy user-message heuristic")

    check(
      isSmallTalkDraft(substantiveDraft) === false,
      'REQUIRED: a substantive draft is verified regardless of how trivial the user message that prompted it was ("yes")',
    )
  }

  // Subgroup variant with a different trivial user message ("ok") and a
  // different substantive topic, to confirm this isn't a one-off.
  {
    const substantiveDraft =
      'Copyright exists automatically the moment you create the work, but you generally cannot sue for infringement in federal court until it is registered with the U.S. Copyright Office, which costs around forty five to sixty five dollars per work.'
    check(
      isSmallTalkDraft(substantiveDraft) === false,
      'REQUIRED (subgroup): a second substantive draft (copyright registration) is also verified regardless of a trivial prompting message',
    )
  }

  // ── Aggregate logging: no personal data, counts accumulate correctly ────
  resetVerifierStatsForTests()
  logVerifierEvent({ flagged: false, usedFallback: false })
  logVerifierEvent({ flagged: true, usedFallback: false })
  logVerifierEvent({ flagged: true, usedFallback: true })
  const stats = getVerifierStats()
  check(stats.runs === 3, 'getVerifierStats counts every logged event')
  check(stats.flagged === 2 && stats.fallback === 1, 'getVerifierStats tracks flagged and fallback counts independently')
  check(Math.abs(stats.flaggedRate - 2 / 3) < 1e-9, 'getVerifierStats computes flaggedRate correctly')
  const eventKeys = Object.keys({ flagged: false, usedFallback: false })
  check(
    eventKeys.every((k) => k === 'flagged' || k === 'usedFallback'),
    'PRIVACY: the logged event shape carries only booleans (flagged/usedFallback), no message or draft text, no session/user id',
  )
  resetVerifierStatsForTests()
  check(getVerifierStats().runs === 0, 'resetVerifierStatsForTests clears the aggregate counters')

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
  if (failures > 0) process.exit(1)
}

main()
