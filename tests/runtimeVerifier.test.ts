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
  isSmallTalk,
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

  // ── runVerifiedAnswer: the other required scenario — a verifier
  // timeout/error (verify() returning null) falls back safely, the draft
  // never leaks ─────────────────────────────────────────────────────────────
  {
    const BAD_OR_UNKNOWN_DRAFT = 'Some answer the verifier could not check because it kept timing out.'
    const result = await runVerifiedAnswer({
      initialDraft: BAD_OR_UNKNOWN_DRAFT,
      verify: async () => null, // simulates resolveVerdict's fail-closed null from a timeout or error
      regenerate: async () => 'a second draft, also unverifiable',
      fallbackText: 'FALLBACK: verifier unavailable.',
    })
    check(
      result.text !== BAD_OR_UNKNOWN_DRAFT && result.text !== 'a second draft, also unverifiable',
      'REQUIRED: a verifier failure (null verdict) never leaks the draft, original or regenerated',
    )
    check(result.text === 'FALLBACK: verifier unavailable.' && result.usedFallback, 'a verifier failure falls back to the safe response')
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

  // ── isSmallTalk ──────────────────────────────────────────────────────────
  check(isSmallTalk('thanks!') === true, 'isSmallTalk flags "thanks!"')
  check(isSmallTalk('ok') === true, 'isSmallTalk flags "ok"')
  check(isSmallTalk('  Hello  ') === true, 'isSmallTalk flags "Hello" ignoring surrounding whitespace/case')
  check(isSmallTalk('') === true, 'isSmallTalk flags an empty message')
  check(isSmallTalk('What is an LLC?') === false, 'isSmallTalk does not flag a real question')
  check(
    isSmallTalk("Thanks for explaining, but what about a 4-person equal split?") === false,
    'isSmallTalk does not flag a message that merely starts with a small-talk word but continues with real content',
  )
  check(isSmallTalk('Do I need a registered agent in Delaware?') === false, 'isSmallTalk does not flag a substantive compliance question')

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
