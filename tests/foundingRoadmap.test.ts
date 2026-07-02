import { buildRoadmap, ROADMAP_DISCLAIMER, type Roadmap } from '../lib/foundingRoadmap'
import { emptyProfile, type FounderProfile } from '../lib/founderProfile'

interface Case {
  name: string
  run: () => boolean
}

function profile(overrides: Partial<FounderProfile>): FounderProfile {
  return { ...emptyProfile(), ...overrides }
}

const stepIds = (r: Roadmap) => r.steps.map((s) => s.id)
const stepById = (r: Roadmap, id: string) => r.steps.find((s) => s.id === id)

const cases: Case[] = [
  {
    name: 'every roadmap carries the educational disclaimer verbatim',
    run: () => buildRoadmap(null).disclaimer === ROADMAP_DISCLAIMER,
  },
  {
    name: 'null profile still returns a starting roadmap (generic track)',
    run: () => {
      const r = buildRoadmap(null)
      return r.steps.length > 0 && stepIds(r).includes('clarify_concept')
    },
  },
  {
    name: 'a fresh product profile marks the first step current, later steps upcoming',
    run: () => {
      const r = buildRoadmap(profile({ business_type: 'product' }))
      const first = stepById(r, 'clarify_concept')
      const reg = stepById(r, 'register_with_state')
      return first?.status === 'current' && reg?.status === 'upcoming'
    },
  },
  {
    name: 'describing the concept marks clarify_concept done and advances current to structure',
    run: () => {
      const r = buildRoadmap(profile({ business_type: 'product', product_description: 'A budgeting app' }))
      return (
        stepById(r, 'clarify_concept')?.status === 'done' &&
        stepById(r, 'choose_structure')?.status === 'current'
      )
    },
  },
  {
    name: 'registered=true marks register_with_state done',
    run: () => {
      const r = buildRoadmap(
        profile({ business_type: 'product', product_description: 'App', structure: 'LLC', registered: true }),
      )
      return stepById(r, 'register_with_state')?.status === 'done'
    },
  },
  {
    name: 'core_documents is done only when all recommended docs are confirmed',
    run: () => {
      const notDone = buildRoadmap(
        profile({
          business_type: 'product',
          recommended_documents: ['founders_agreement', 'mutual_nda'],
          confirmed_documents: ['founders_agreement'],
        }),
      )
      const done = buildRoadmap(
        profile({
          business_type: 'product',
          recommended_documents: ['founders_agreement', 'mutual_nda'],
          confirmed_documents: ['founders_agreement', 'mutual_nda'],
        }),
      )
      return (
        stepById(notDone, 'core_documents')?.status !== 'done' &&
        stepById(done, 'core_documents')?.status === 'done'
      )
    },
  },
  {
    name: 'nonprofit track shows incorporation and governance, not for-profit structure step',
    run: () => {
      const r = buildRoadmap(profile({ business_type: 'nonprofit' }))
      const ids = stepIds(r)
      return (
        ids.includes('incorporate_nonprofit') &&
        ids.includes('governance_documents') &&
        !ids.includes('choose_structure')
      )
    },
  },
  {
    name: 'nonprofit governance step is done only with both bylaws and conflict-of-interest confirmed',
    run: () => {
      const partial = buildRoadmap(
        profile({ business_type: 'nonprofit', confirmed_documents: ['nonprofit_bylaws'] }),
      )
      const full = buildRoadmap(
        profile({
          business_type: 'nonprofit',
          confirmed_documents: ['nonprofit_bylaws', 'nonprofit_conflict_of_interest'],
        }),
      )
      return (
        stepById(partial, 'governance_documents')?.status !== 'done' &&
        stepById(full, 'governance_documents')?.status === 'done'
      )
    },
  },
  {
    name: 'ongoing/reference steps are always status "ongoing", never done/current',
    run: () => {
      const r = buildRoadmap(
        profile({ business_type: 'product', product_description: 'App', structure: 'LLC', registered: true }),
      )
      const ein = stepById(r, 'get_ein')
      return ein?.status === 'ongoing'
    },
  },
  {
    name: 'EIN reference step keeps the free / avoid-third-party guidance',
    run: () => {
      const r = buildRoadmap(profile({ business_type: 'consulting' }))
      const ein = stepById(r, 'get_ein')
      return !!ein && /free/i.test(ein.nextAction) && /irs\.gov/i.test(ein.nextAction)
    },
  },
  {
    name: 'charitable-registration reference appears only when the nonprofit takes money',
    run: () => {
      const without = buildRoadmap(profile({ business_type: 'nonprofit' }))
      const withMoney = buildRoadmap(
        profile({ business_type: 'nonprofit', taking_money_from: 'individual donations' }),
      )
      return (
        !stepIds(without).includes('charitable_registration') &&
        stepIds(withMoney).includes('charitable_registration')
      )
    },
  },
  {
    name: 'data/IP reference tailors its wording to the profile flags',
    run: () => {
      const r = buildRoadmap(profile({ business_type: 'product', handles_user_data: true }))
      const step = stepById(r, 'data_and_ip')
      return !!step && /privacy policy/i.test(step.nextAction)
    },
  },
  {
    name: 'headline reflects how many core steps are done',
    run: () => {
      const fresh = buildRoadmap(profile({ business_type: 'product' }))
      const some = buildRoadmap(profile({ business_type: 'product', product_description: 'App', structure: 'LLC' }))
      return /just getting started/i.test(fresh.headline) && /2 of 4/.test(some.headline)
    },
  },
  {
    name: 'SAFETY: no step ever tells the founder they are compliant, done legally, or all set',
    run: () => {
      const profiles: FounderProfile[] = [
        profile({ business_type: 'product', product_description: 'App', structure: 'LLC', registered: true, recommended_documents: ['founders_agreement'], confirmed_documents: ['founders_agreement'] }),
        profile({ business_type: 'nonprofit', registered: true, confirmed_documents: ['nonprofit_bylaws', 'nonprofit_conflict_of_interest'] }),
        buildRoadmapProfileNull(),
      ]
      return profiles.every((p) => {
        const r = buildRoadmap(p)
        const text = `${r.headline} ${r.steps.map((s) => `${s.title} ${s.whatItIs} ${s.nextAction}`).join(' ')}`
        return (
          !/legally (compliant|fine|safe|set)/i.test(text) &&
          !/you'?re (all set|compliant|done|good to go|fully covered)/i.test(text) &&
          !/no (need|reason) to (see|consult) a (lawyer|attorney)/i.test(text)
        )
      })
    },
  },
  {
    name: 'SAFETY: "all core steps done" headline still points to ongoing items, not completion',
    run: () => {
      const r = buildRoadmap(
        profile({ business_type: 'product', product_description: 'App', structure: 'LLC', registered: true, recommended_documents: ['founders_agreement'], confirmed_documents: ['founders_agreement'] }),
      )
      return /ongoing/i.test(r.headline) && !/legally/i.test(r.headline)
    },
  },
  {
    name: 'every step id in a roadmap is unique',
    run: () => {
      const r = buildRoadmap(profile({ business_type: 'nonprofit', taking_money_from: 'grants' }))
      return new Set(stepIds(r)).size === r.steps.length
    },
  },
]

// Helper kept out-of-line so the SAFETY case reads cleanly.
function buildRoadmapProfileNull(): FounderProfile {
  return emptyProfile()
}

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
