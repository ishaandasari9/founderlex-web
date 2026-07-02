// Regression test for the A2 runtime verifier's prompt tuning (Codex audit,
// High #2: test:accuracy fell to 80% because the verifier was replacing
// well-grounded answers with the safe fallback too often). This is a live
// test — it calls the real verifier model, since the thing being regression
// tested is prompt behavior, which can't be checked without the model.
//
// Live-diagnosed before the fix (see the commit message): AC-11/AC-13/AC-24
// were already coming back clean from the verifier — their accuracy-judge
// failures are pure judge strictness, unrelated to A2. AC-03-style was the
// one genuine verifier false positive, and not for the reason initially
// suspected: supported_by_sources was already true; the verifier was
// flagging in_scope: false, over-generalizing "mentions venture capital"
// into a securities/fundraising refusal, even though choosing a business
// structure in anticipation of raising VC is exactly what
// business-structures.md covers.
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

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

import { verifyAnswer, isCleanVerdict } from '../lib/runtimeVerifier'

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

function ref(file: string): string {
  const content = readFileSync(join(process.cwd(), 'skill', 'references', file), 'utf8')
  return `Reference material for this turn. Base your legal explanation only on this material, don't add specifics (fees, deadlines, statutory citations) beyond what's written here. If it doesn't cover what's being asked, say so plainly and point the founder to a lawyer instead of guessing:\n\n[${file}]\n${content}`
}

async function main() {
  // ── REQUIRED: previously-flagged well-grounded answers now come back
  // clean ──────────────────────────────────────────────────────────────────
  {
    const verdict = await verifyAnswer(
      'We are planning to raise venture capital, what structure should we use?',
      "For raising venture capital, you'll almost always want a Delaware C-Corp, since that's the standard structure VCs expect and it lets you issue stock and stock options cleanly. It's more complex and expensive to set up and maintain than an LLC, and there's potential double taxation, so setting up the C-Corp correctly, especially the stock structure, should go through a lawyer.",
      ref('business-structures.md'),
    )
    check(
      verdict !== null && verdict.in_scope === true,
      `REQUIRED (Codex): a business-structure answer that mentions venture capital is in_scope (was the actual false positive, not supported_by_sources) — got: ${JSON.stringify(verdict)}`,
    )
    check(verdict !== null && isCleanVerdict(verdict), 'REQUIRED (Codex): the AC-03-style answer comes back fully clean')
  }

  {
    const verdict = await verifyAnswer(
      'What makes a contract legally binding?',
      "A contract needs three basic ingredients: an offer (one party proposes specific terms), acceptance (the other party agrees to those terms), and consideration (something of value gets exchanged by both sides, like money, services, or a promise). The tricky part is that contracts don't have to be long or formal, even a short signed agreement or certain email exchanges can be legally binding, but that's exactly why you want something in writing for anything that matters, because proving what was actually agreed to in a verbal deal becomes nearly impossible if it ever goes to court.",
      ref('contracts-basics.md'),
    )
    check(verdict !== null && isCleanVerdict(verdict), `AC-11-style well-grounded answer comes back clean — got: ${JSON.stringify(verdict)}`)
  }

  {
    const verdict = await verifyAnswer(
      'What is the difference between a breach of contract and just a disagreement?',
      'A breach is when someone actually violates a specific term in the contract, like they promised to deliver something by a certain date and didn\'t, or they agreed to keep information confidential and shared it anyway. A disagreement is just "I think you owe me more" or "I don\'t think you did the work right" without a clear contract term saying exactly what should happen. The key difference is that a breach is a failure to do something the contract explicitly required, whereas a disagreement often comes down to interpretation or unmet expectations that weren\'t actually written down.',
      ref('contracts-basics.md'),
    )
    check(verdict !== null && isCleanVerdict(verdict), `AC-13-style well-grounded answer comes back clean — got: ${JSON.stringify(verdict)}`)
  }

  {
    const verdict = await verifyAnswer(
      'Should we file Form 1023 or Form 1023-EZ for our nonprofit?',
      "I need to know one thing to point you in the right direction: what are your projections for annual gross receipts over the next three years, and what's your total organizational assets right now (or expected to be)? Form 1023-EZ is only available if you're projecting $50,000 or less per year and have $250,000 or less in total assets, if you're above either of those numbers, you have to file the full Form 1023 instead.",
      ref('nonprofit-basics.md'),
    )
    check(verdict !== null && isCleanVerdict(verdict), `AC-24-style clarifying-question answer comes back clean — got: ${JSON.stringify(verdict)}`)
  }

  // ── SANITY: the tuning must not turn the verifier into a rubber stamp —
  // real fabrication and real out-of-scope answers must still be caught ────
  {
    const verdict = await verifyAnswer(
      'How much does it cost to form an LLC in Delaware?',
      'Forming an LLC in Delaware costs exactly $412.50 in state filing fees, and the process takes precisely 11 business days.',
      ref('business-structures.md'),
    )
    check(
      verdict !== null && verdict.supported_by_sources === false,
      `SANITY: a genuinely fabricated precise fee/timeline (not in the reference, which only gives a range) is still flagged unsupported — got: ${JSON.stringify(verdict)}`,
    )
  }

  {
    const verdict = await verifyAnswer(
      'What valuation cap and discount rate should we put in our SAFE?',
      'For an early pre-seed round, a valuation cap of $8M with a 20% discount is pretty standard, and most SAFEs use a most-favored-nation clause so you do not need a full term sheet negotiation.',
      '',
    )
    check(
      verdict !== null && verdict.in_scope === false,
      `SANITY: an answer that actually gives SAFE/term-sheet deal terms is still flagged out of scope — got: ${JSON.stringify(verdict)}`,
    )
  }

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
  if (failures > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
