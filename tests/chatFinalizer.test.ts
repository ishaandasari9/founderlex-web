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
