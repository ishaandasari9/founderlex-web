import { containsForbiddenAssertion, finalizeExplanation, explainForm, EXPLAIN_CLOSING_LINE } from '../lib/explainForm'

interface Case {
  name: string
  run: () => Promise<boolean> | boolean
}

const GOOD_EXPLANATION = `1. Here's what this form appears to be
This looks like a mutual non-disclosure agreement between two companies.

2. Plain-English summary
Both sides agree to keep confidential information secret for two years.

3. Sections that matter most
The definition of confidential information and the term length.

4. Things to double-check
The effective date field is blank, and the governing state is not filled in.

5. Questions to ask a lawyer
Is the two-year term long enough for our situation?`

const cases: Case[] = [
  {
    name: 'EXPLAIN_CLOSING_LINE matches the exact required sentence',
    run: () => EXPLAIN_CLOSING_LINE === "I can explain this, but I can't tell you whether signing it is legally safe.",
  },
  {
    name: 'containsForbiddenAssertion flags "you should sign this"',
    run: () => containsForbiddenAssertion('Overall, you should sign this without worry.') === true,
  },
  {
    name: 'containsForbiddenAssertion flags "this is legally fine"',
    run: () => containsForbiddenAssertion('This is legally fine and you can proceed.') === true,
  },
  {
    name: 'containsForbiddenAssertion flags "safe to sign"',
    run: () => containsForbiddenAssertion('It looks safe to sign as written.') === true,
  },
  {
    name: 'containsForbiddenAssertion does not flag neutral explanatory text',
    run: () => containsForbiddenAssertion(GOOD_EXPLANATION) === false,
  },
  {
    name: 'finalizeExplanation appends the exact closing line to a clean explanation',
    run: () => finalizeExplanation(GOOD_EXPLANATION).endsWith(EXPLAIN_CLOSING_LINE),
  },
  {
    name: 'finalizeExplanation strips markdown headers and emphasis the model added anyway',
    run: () => {
      const withMarkdown = '# Questions to ask a lawyer\n\n1. **Is the non-compete enforceable** in *your* state?'
      const result = finalizeExplanation(withMarkdown)
      return !/[#*]/.test(result) && result.includes('Is the non-compete enforceable in your state?')
    },
  },
  {
    name: 'finalizeExplanation does not duplicate a closing line the model already attempted',
    run: () => {
      const withAttempt = `${GOOD_EXPLANATION}\n\nI can explain this, but I can't say if it's legally safe.`
      const result = finalizeExplanation(withAttempt)
      const occurrences = (result.match(/I can explain this/g) ?? []).length
      return occurrences === 1 && result.endsWith(EXPLAIN_CLOSING_LINE)
    },
  },
  {
    name: 'finalizeExplanation replaces the whole reply with a safe fallback when a forbidden assertion slips through',
    run: () => {
      const bad = `${GOOD_EXPLANATION}\n\nYou should sign this today.`
      const result = finalizeExplanation(bad)
      return !containsForbiddenAssertion(result) && result.endsWith(EXPLAIN_CLOSING_LINE)
    },
  },
  {
    name: 'explainForm rejects empty input without making a network call',
    run: async () => {
      try {
        await explainForm('   ')
        return false
      } catch {
        return true
      }
    },
  },
  {
    name: 'explainForm routes pasted text through the existing out-of-scope guard (no network call)',
    run: async () => {
      const result = await explainForm('This is a cease and desist letter I received from a competitor.')
      return result.includes('licensed attorney') && !result.includes(EXPLAIN_CLOSING_LINE)
    },
  },
  {
    name: 'explainForm out-of-scope guard also catches securities/fundraising documents',
    run: async () => {
      const result = await explainForm('Please explain this SAFE and convertible note term sheet.')
      return result.toLowerCase().includes('securities')
    },
  },
]

let failures = 0

async function main() {
  for (const c of cases) {
    const pass = await c.run()
    if (pass) {
      console.log(`PASS  ${c.name}`)
    } else {
      failures++
      console.log(`FAIL  ${c.name}`)
    }
  }

  console.log(`\n${cases.length - failures}/${cases.length} passed`)
  if (failures > 0) process.exit(1)
}

main()
