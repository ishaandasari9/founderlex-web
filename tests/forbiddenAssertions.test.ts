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

  // Name/trademark-verdict phrasing (Name & Similar Org Search feature) —
  // must catch the exact mission-boundary words: available, clear, safe,
  // approved, no conflict.
  { name: 'NAME SEARCH: flags "this name is available"', run: () => containsForbiddenAssertion('Based on my search, this name is available.') },
  { name: 'NAME SEARCH: flags "name looks clear"', run: () => containsForbiddenAssertion('The name looks clear to me.') },
  { name: 'NAME SEARCH: flags "name is approved"', run: () => containsForbiddenAssertion('Good news, this name is approved for your use.') },
  { name: 'NAME SEARCH: flags "safe to use" (this name)', run: () => containsForbiddenAssertion('It looks safe to use as your company name.') },
  { name: 'NAME SEARCH: flags "okay to use"', run: () => containsForbiddenAssertion('This name looks okay to use.') },
  { name: 'NAME SEARCH: flags "ready to launch"', run: () => containsForbiddenAssertion('This appears ready to launch.') },
  { name: 'NAME SEARCH: flags "clear to register"', run: () => containsForbiddenAssertion('This appears clear to register right away.') },
  { name: 'NAME SEARCH: flags "no trademark conflicts"', run: () => containsForbiddenAssertion('I found no trademark conflicts with this name.') },
  { name: 'NAME SEARCH: flags "no conflict with this name"', run: () => containsForbiddenAssertion('There is no conflict with this name in the results.') },
  { name: 'NAME SEARCH: flags "free and clear"', run: () => containsForbiddenAssertion('This name is free and clear based on what I found.') },
  { name: 'NAME SEARCH: flags "free to use the name"', run: () => containsForbiddenAssertion('You are free to use the name without any issue.') },
  { name: 'NAME SEARCH: flags "you can safely use this name"', run: () => containsForbiddenAssertion('Based on the results, you can safely use this name.') },
  { name: 'NAME SEARCH: flags markdown-split "name is available"', run: () => containsForbiddenAssertion('This **name** is **available** based on my search.') },

  // False-positive guards specific to the name-verdict expansion: "conflict,"
  // "clear," and "available" are all extremely common outside a naming
  // verdict, and must stay allowed in their ordinary FounderLex uses.
  { name: 'does NOT flag legitimate nonprofit "conflict of interest" content', run: () => !containsForbiddenAssertion('Your Conflict of Interest Policy should require board members to disclose conflicts before voting, and there were no conflicts of interest reported this year.') },
  { name: 'does NOT flag "form is available" (unrelated to a name verdict)', run: () => !containsForbiddenAssertion('The Advisor Agreement template is available as a PDF or Word document.') },
  { name: 'does NOT flag "it is clear that" as ordinary phrasing', run: () => !containsForbiddenAssertion('It is clear that you should talk to an attorney before finalizing this.') },
  { name: 'does NOT flag a correct recommendation to check with a trademark attorney', run: () => !containsForbiddenAssertion('A trademark attorney should review before you spend money on branding.') },
  { name: 'does NOT flag neutral reporting of search findings without a verdict', run: () => !containsForbiddenAssertion('I found a company called Acme Robotics Inc. registered in Delaware, in the consumer robotics space.') },

  // Overconfident legal-outcome language outside the signing/naming context
  // (Codex audit, AC-10 false negative): "you're protected"/"you're
  // covered" assert a guaranteed liability outcome the same way "you'll be
  // fine" does, but were missing from the pattern list.
  { name: 'REGRESSION (Codex): flags "Lock it in writing, and you\'re protected."', run: () => containsForbiddenAssertion("Lock it in writing, and you're protected.") },
  { name: 'REGRESSION (Codex): flags "you\'re fully covered"', run: () => containsForbiddenAssertion("As long as you have an NDA, you're fully covered.") },
  { name: 'REGRESSION (Codex): flags "you are covered" (no contraction)', run: () => containsForbiddenAssertion('Do that and you are covered.') },
  { name: 'REGRESSION (Codex): flags "you’re protected" (curly apostrophe)', run: () => containsForbiddenAssertion('Sign it and you’re protected.') },
  { name: 'does NOT flag "you\'re not protected" (negation breaks the adjacency)', run: () => !containsForbiddenAssertion("You're not protected until the contract is signed, so get it in writing first.") },
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
