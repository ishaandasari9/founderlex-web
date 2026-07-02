import { containsForbiddenAssertion } from '../lib/forbiddenAssertions'

interface Case {
  name: string
  run: () => boolean
}

const cases: Case[] = [
  // Original exact-phrase patterns
  { name: 'flags "you should sign this"', run: () => containsForbiddenAssertion('You should sign this today.') },
  { name: 'flags "this is legally fine"', run: () => containsForbiddenAssertion('This is legally fine and you can proceed.') },
  { name: 'flags "safe to sign"', run: () => containsForbiddenAssertion('It looks safe to sign as written.') },
  { name: 'flags "no need to consult"', run: () => containsForbiddenAssertion('No need to consult a lawyer on this one.') },

  // Markdown/punctuation-split evasion (prior regression)
  { name: 'flags a phrase split by markdown emphasis', run: () => containsForbiddenAssertion('You can **safely** sign this.') },
  { name: 'flags a phrase split by punctuation', run: () => containsForbiddenAssertion('You can, safely, sign this.') },

  // Codex-requested paraphrase coverage
  { name: 'REGRESSION (Codex): flags "green light to sign"', run: () => containsForbiddenAssertion('This gives you a green light to sign.') },
  { name: 'REGRESSION (Codex): flags "greenlit" / no-space variant', run: () => containsForbiddenAssertion('Consider this greenlit, go ahead.') },
  { name: 'REGRESSION (Codex): flags markdown-split "green light"', run: () => containsForbiddenAssertion('This is a **green light** to sign.') },
  { name: 'REGRESSION (Codex): flags "I\'d be comfortable signing"', run: () => containsForbiddenAssertion("I'd be comfortable signing this if I were you.") },
  { name: 'REGRESSION (Codex): flags "comfortable with you signing"', run: () => containsForbiddenAssertion("I'm comfortable with you signing this agreement.") },
  { name: 'REGRESSION (Codex): flags "no attorney review needed"', run: () => containsForbiddenAssertion('No attorney review needed for this one.') },
  { name: 'REGRESSION (Codex): flags "don\'t need a lawyer to review this"', run: () => containsForbiddenAssertion("You don't need a lawyer to review this contract.") },
  { name: 'REGRESSION (Codex): flags "skip the lawyer"', run: () => containsForbiddenAssertion('Honestly, skip the lawyer on this one.') },
  { name: 'REGRESSION (Codex): flags "you\'re good to sign"', run: () => containsForbiddenAssertion("You're good to sign whenever you're ready.") },
  { name: 'REGRESSION (Codex): flags "nothing here should stop you from signing"', run: () => containsForbiddenAssertion('Nothing here should stop you from signing.') },

  // False-positive guards: legitimate, accurate FounderLex-style advice that
  // must NOT be flagged just because it mentions a lawyer/attorney.
  { name: 'does NOT flag accurate narrow guidance unrelated to signing ("EIN")', run: () => !containsForbiddenAssertion("You don't need a lawyer to get an EIN, it's free directly from the IRS.") },
  { name: 'does NOT flag a correct recommendation to get a lawyer', run: () => !containsForbiddenAssertion('You should talk to a startup attorney before finalizing any equity grant.') },
  { name: 'does NOT flag mentioning "review" and "lawyer" together as advice to seek review', run: () => !containsForbiddenAssertion('Have a lawyer review this before you sign anything.') },
  { name: 'does NOT flag neutral explanatory text about vesting and equity', run: () => !containsForbiddenAssertion("A Founders' Agreement locks in your equity split and vesting schedule before you build anything.") },
]

let failures = 0

for (const c of cases) {
  const pass = c.run()
  if (pass) {
    console.log(`PASS  ${c.name}`)
  } else {
    failures++
    console.log(`FAIL  ${c.name}`)
  }
}

console.log(`\n${cases.length - failures}/${cases.length} passed`)
if (failures > 0) process.exit(1)
