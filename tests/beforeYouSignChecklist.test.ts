import { buildChecklist } from '../lib/beforeYouSignChecklist'

interface Case {
  name: string
  run: () => boolean
}

const foundersFilled = 'This agreement covers vesting. [TO BE COMPLETED: cliff period] applies to all founders.'
const cleanFilled = 'No blanks left in this document.'

const cases: Case[] = [
  {
    name: 'every checklist includes the universal base items',
    run: () => {
      const items = buildChecklist('mutual_nda', cleanFilled).map(i => i.text).join(' ')
      return (
        items.includes('Review every name, date, percentage, dollar amount, and signature line for accuracy') &&
        items.includes('Confirm the document matches what everyone actually agreed to') &&
        items.includes("Don't sign, file, or send it until you understand every section") &&
        items.includes('save a copy of the final version')
      )
    },
  },
  {
    name: 'checklist calls out specific unresolved blanks when present',
    run: () => {
      const items = buildChecklist('founders_agreement', foundersFilled).map(i => i.text).join(' ')
      return items.includes('[TO BE COMPLETED: cliff period]') && items.includes('Fill in the 1 remaining blank')
    },
  },
  {
    name: 'checklist reassures when no blanks remain',
    run: () => {
      const items = buildChecklist('mutual_nda', cleanFilled).map(i => i.text).join(' ')
      return items.includes('Double-check there are no [TO BE COMPLETED] blanks')
    },
  },
  {
    name: "founders' agreement checklist flags equity split and vesting",
    run: () => {
      const items = buildChecklist('founders_agreement', cleanFilled).map(i => i.text).join(' ')
      return items.includes('equity split') && items.includes('vesting schedule and cliff')
    },
  },
  {
    name: 'NDA checklist flags term and parties, not equity/vesting',
    run: () => {
      const items = buildChecklist('mutual_nda', cleanFilled).map(i => i.text).join(' ')
      return items.includes('the term (how long confidentiality lasts) and the parties named') && !items.includes('vesting')
    },
  },
  {
    name: 'nonprofit Articles checklist flags IRS purpose/dissolution clauses',
    run: () => {
      const items = buildChecklist('nonprofit_articles', cleanFilled).map(i => i.text).join(' ')
      return items.includes('organizational purpose clause and dissolution clause')
    },
  },
  {
    name: 'nonprofit Articles checklist flags state-then-federal filing order',
    run: () => {
      const items = buildChecklist('nonprofit_articles', cleanFilled).map(i => i.text).join(' ')
      return (
        items.includes("File this with your state's Secretary of State first") &&
        items.includes('EIN') &&
        items.includes('Form 1023-EZ') &&
        items.includes('full Form 1023')
      )
    },
  },
  {
    name: 'unknown template falls back to generic high-risk language without crashing',
    run: () => {
      const items = buildChecklist('some_future_template', cleanFilled).map(i => i.text).join(' ')
      return items.includes('any section describing money, ownership, or liability')
    },
  },
  {
    name: 'every checklist item has a unique id',
    run: () => {
      const items = buildChecklist('founders_agreement', foundersFilled)
      return new Set(items.map(i => i.id)).size === items.length
    },
  },
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
