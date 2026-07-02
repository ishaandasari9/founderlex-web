import { detectRedFlags } from '../lib/redFlags'
import { GUARD_CATEGORIES } from '../lib/outOfScopeGuard'

interface Case {
  name: string
  run: () => boolean
}

function flagIds(text: string): string[] {
  return detectRedFlags(text).map(f => f.id)
}

const cases: Case[] = [
  {
    name: 'flags a possible criminal matter (reused from outOfScopeGuard)',
    run: () => flagIds('I received a subpoena yesterday').includes('criminal'),
  },
  {
    name: 'flags an active dispute (cease and desist)',
    run: () => flagIds('We got a cease and desist letter from a competitor').includes('active_dispute'),
  },
  {
    name: 'flags securities/fundraising language',
    run: () => flagIds("We're closing a seed round with a SAFE").includes('securities'),
  },
  {
    name: 'flags immigration questions',
    run: () => flagIds("I'm on an F-1 visa, can I start a company?").includes('immigration'),
  },
  {
    name: 'flags tax strategy questions',
    run: () => flagIds('How do I minimize my tax burden as a founder?').includes('tax_strategy'),
  },
  {
    name: 'flags university-owned IP',
    run: () => flagIds("I built this in my university's research lab using grant funding").includes('university_ip'),
  },
  {
    name: 'flags minors involved',
    run: () => flagIds('Our app will have child users under 13').includes('minors'),
  },
  {
    name: 'flags employee vs. contractor classification',
    run: () => flagIds('Should I 1099 this person or bring them on as a W-2 employee?').includes('worker_classification'),
  },
  {
    name: 'flags collecting user data',
    run: () => flagIds('We collect user data including payment information').includes('user_data'),
  },
  {
    name: 'flags taking donations before nonprofit compliance',
    run: () => flagIds('Can we start accepting donations before our 501(c)(3) is approved?').includes('donations_before_compliance'),
  },
  {
    name: 'flags equity or advisor share grants',
    run: () => flagIds('I want to give my advisor equity with a 4-year vesting schedule').includes('equity_advisor_grants'),
  },
  {
    name: 'returns no flags for ordinary, low-risk text',
    run: () => detectRedFlags("I'm building a mobile app that helps people track workouts").length === 0,
  },
  {
    name: 'detects multiple flags in one message',
    run: () => {
      const ids = flagIds('We collect user data and want to give our advisor equity with a vesting schedule')
      return ids.includes('user_data') && ids.includes('equity_advisor_grants')
    },
  },
  {
    name: 'each red flag includes a plain-English reason and who to talk to',
    run: () => {
      const flags = detectRedFlags('I received a cease and desist letter')
      return flags.length > 0 && flags.every(f => f.whyItMatters.length > 0 && f.talkTo.length > 0)
    },
  },
  {
    name: 'every GUARD_CATEGORIES id used by the hard-stop guard has matching red-flag copy',
    run: () => {
      // Guards against silently losing card copy if outOfScopeGuard.ts adds a
      // new category and this file isn't updated to match.
      const triggerPhrases: Record<string, string> = {
        criminal: 'I was arrested last week',
        active_dispute: 'they are threatening to sue us',
        securities: 'we have a term sheet from an investor',
        immigration: 'I need a green card',
        tax_strategy: 'thinking about an s-corp election',
      }
      return GUARD_CATEGORIES.every(category => {
        const phrase = triggerPhrases[category.id]
        return !!phrase && flagIds(phrase).includes(category.id)
      })
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
