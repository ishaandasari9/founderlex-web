// Regression test for lib/chat.ts's finalizeChatResponse (Codex audit,
// High #2): the chat pipeline had no deterministic output backstop, so a
// model phrasing like "the wall usually holds up fine" (LLC liability
// veil-piercing) reached the user unfiltered. finalizeChatResponse reuses
// the EXISTING lib/forbiddenAssertions.ts scan (extended with two new
// overconfident-outcome patterns) rather than forking a second list.
// Deterministic, no API calls — exercises the finalizer directly on raw
// model-style text.
import { finalizeChatResponse } from '../lib/chat'

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

const FALLBACK_MARKER = 'check the specifics with a licensed attorney'

// The exact Codex-reported phrasing.
check(
  finalizeChatResponse(
    "As long as you keep clean records and sign things in the company's name, the wall usually holds up fine.",
  ).includes(FALLBACK_MARKER),
  'flags the exact Codex-reported phrase: "the wall usually holds up fine"',
)

// New pattern, alternate wording.
check(
  finalizeChatResponse("Don't worry about it, you'll be fine either way.").includes(FALLBACK_MARKER),
  'flags "you\'ll be fine"',
)
check(
  finalizeChatResponse('Do it that way and you will be fine.').includes(FALLBACK_MARKER),
  'flags "you will be fine" (no contraction)',
)
check(
  finalizeChatResponse('Sign it that way and you’ll be fine.').includes(FALLBACK_MARKER),
  'flags "you’ll be fine" (curly apostrophe)',
)

// REQUIRED (Codex audit, AC-10): "you're protected" / "you're covered" is
// the same overconfident-outcome category as "you'll be fine" above, but
// was missing from the pattern list.
check(
  finalizeChatResponse("Lock it in writing, and you're protected.").includes(FALLBACK_MARKER),
  "REQUIRED (Codex): flags \"Lock it in writing, and you're protected.\"",
)
check(
  finalizeChatResponse("As long as you have an NDA, you're fully covered.").includes(FALLBACK_MARKER),
  'flags "you\'re fully covered"',
)
check(
  finalizeChatResponse('Do that and you are covered.').includes(FALLBACK_MARKER),
  'flags "you are covered" (no contraction)',
)
check(
  finalizeChatResponse('Sign it and you’re protected.').includes(FALLBACK_MARKER),
  'flags "you’re protected" (curly apostrophe)',
)
check(
  !finalizeChatResponse("You're not protected until the contract is signed, so get it in writing first.").includes(FALLBACK_MARKER),
  'does NOT flag "you\'re not protected" (negation breaks the adjacency, correctly accurate advice)',
)

// REQUIRED (Codex re-review, High #1): the hand-maintained CONFUSABLES map
// missed Cyrillic "р" (U+0440), which visually reads as Latin "p" but
// wasn't in the fold table, letting "you're рrotected" evade detection
// entirely. Now handled by the `confusables` package's proper Unicode
// skeleton normalization instead of a hand-picked character list.
check(
  finalizeChatResponse("Lock it in writing, and you're рrotected.").includes(FALLBACK_MARKER),
  'REQUIRED (Codex): flags the exact reported bypass — Cyrillic "р" (U+0440) in "you\'re рrotected"',
)
check(
  finalizeChatResponse("Lock it in writing, and you're p​rotected.").includes(FALLBACK_MARKER),
  'REQUIRED (Codex): flags a zero-width character inside "protected"',
)
check(
  finalizeChatResponse('Do that and you are ｃｏｖｅｒｅｄ.').includes(FALLBACK_MARKER),
  'REQUIRED (Codex): flags a full-width Unicode variant of "covered"',
)
check(
  finalizeChatResponse('Sign it and you’re ｐｒｏｔｅｃｔｅｄ.').includes(FALLBACK_MARKER),
  'REQUIRED (Codex): flags a full-width Unicode variant of "protected"',
)
check(
  finalizeChatResponse("As long as you have an NDA, you're cоvered.").includes(FALLBACK_MARKER),
  'flags Cyrillic "о" (looks like Latin "o") in "covered"',
)

// REQUIRED (Codex re-review, High #3, EC-08): the dash-to-comma formatting
// step corrupted a numeric dollar range written with the typographically-
// correct en dash — "$45–65" became "$45, 65", reproducible every time,
// not model variance. A digit-dash-digit span must become a hyphenated
// range instead of falling through to the general comma replacement.
const MALFORMED_RANGE = /\$\d+,\s*\d+\b/
check(
  !MALFORMED_RANGE.test(finalizeChatResponse('Registration is cheap, $45–65, and worth doing.')),
  'REQUIRED (Codex): "$45–65" (en dash) does not become the malformed "$45, 65"',
)
check(
  finalizeChatResponse('Registration is cheap, $45–65, and worth doing.').includes('$45-65'),
  'REQUIRED (Codex): "$45–65" becomes the correctly hyphenated "$45-65"',
)
check(
  !MALFORMED_RANGE.test(finalizeChatResponse('It typically costs $50—500 depending on the state.')),
  'the same fix applies to an em-dash range ("$50—500")',
)
check(
  finalizeChatResponse('It typically costs $50—500 depending on the state.').includes('$50-500'),
  'the em-dash range becomes the correctly hyphenated "$50-500"',
)
check(
  finalizeChatResponse('Filing fees run $250–$600 depending on the form.').includes('$250-$600'),
  'a range with a dollar sign on both numbers is also preserved correctly ("$250-$600")',
)
check(
  !MALFORMED_RANGE.test(
    finalizeChatResponse(
      "Copyright is automatic, but you generally can't sue for infringement unless you register it first at copyright.gov (cheap, $45–65), and that's especially important for your codebase.",
    ),
  ),
  'REQUIRED (Codex): the exact reported sentence no longer produces a malformed dollar range',
)
check(
  finalizeChatResponse('Let the founders decide — it is their choice.') === 'Let the founders decide, it is their choice.',
  'an ordinary sentence-level em dash (not between numbers) still becomes a comma, unchanged behavior',
)

// Existing shared patterns, proven to run through this NEW entry point too
// (proves reuse, not just presence of the shared module).
check(
  finalizeChatResponse('This looks safe to sign as written.').includes(FALLBACK_MARKER),
  'flags "safe to sign" through the chat finalizer (reused from forbiddenAssertions)',
)
check(
  finalizeChatResponse('Good news, this name is available.').includes(FALLBACK_MARKER),
  'flags "name is available" through the chat finalizer (reused from forbiddenAssertions)',
)

// False-positive guard: an ordinary, accurate reply must pass through
// unchanged, not get swallowed into the fallback.
const ordinaryReply =
  "An LLC creates a legal separation between the business and your personal assets, but you can lose that protection if you mix personal and business funds. Talk to an attorney about the specifics for your state."
check(finalizeChatResponse(ordinaryReply) === ordinaryReply, 'does not flag an ordinary, accurate reply')

// Formatting is still applied before the safety check (unchanged behavior).
check(
  finalizeChatResponse('This uses **bold** and an em dash — like this.') === 'This uses bold and an em dash, like this.',
  'still strips markdown/em-dashes for a clean reply (pre-existing formatting preserved)',
)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
