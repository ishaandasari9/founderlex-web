import {
  selectCostItems,
  allCostItems,
  COST_DISCLAIMER,
  type CostSituation,
} from '../lib/costEstimator'

interface Case {
  name: string
  run: () => boolean
}

const ids = (bt: Parameters<typeof selectCostItems>[0], sits: CostSituation[] = []) =>
  selectCostItems(bt, sits).items.map((i) => i.id)

const cases: Case[] = [
  {
    name: 'every result carries the educational disclaimer verbatim',
    run: () => selectCostItems('product').disclaimer === COST_DISCLAIMER,
  },
  {
    name: 'disclaimer frames output as rough ranges, not a quote',
    run: () =>
      /rough|typical|range/i.test(COST_DISCLAIMER) &&
      /not a quote/i.test(COST_DISCLAIMER) &&
      /professional|attorney|cpa/i.test(COST_DISCLAIMER),
  },
  {
    name: 'nonprofit sees the 501(c)(3) application cost, not trademark/founders items',
    run: () => {
      const got = ids('nonprofit')
      return (
        got.includes('nonprofit_501c3_application') &&
        !got.includes('trademark_registration') &&
        !got.includes('founders_agreement')
      )
    },
  },
  {
    name: 'product company does NOT see nonprofit-only cost items',
    run: () => {
      const got = ids('product')
      return !got.includes('nonprofit_501c3_application') && !got.includes('charitable_registration')
    },
  },
  {
    name: 'EIN and state formation are universal (all business types)',
    run: () =>
      (['product', 'consulting', 'nonprofit'] as const).every(
        (t) => ids(t).includes('ein') && ids(t).includes('state_formation_filing'),
      ),
  },
  {
    name: 'trademark cost only surfaces when the founder wants a trademark',
    run: () =>
      !ids('product').includes('trademark_registration') &&
      ids('product', ['trademark']).includes('trademark_registration'),
  },
  {
    name: "founders' agreement cost only surfaces when there is equity",
    run: () =>
      !ids('product').includes('founders_agreement') &&
      ids('product', ['has_equity']).includes('founders_agreement'),
  },
  {
    name: 'annual/franchise fees only surface when Delaware situation is active',
    run: () =>
      !ids('product').includes('annual_state_fees') &&
      ids('product', ['delaware']).includes('annual_state_fees'),
  },
  {
    name: 'payroll setup only surfaces when hiring',
    run: () =>
      !ids('consulting').includes('payroll_setup') &&
      ids('consulting', ['hiring']).includes('payroll_setup'),
  },
  {
    name: 'charitable registration only for nonprofits accepting donations',
    run: () =>
      !ids('nonprofit').includes('charitable_registration') &&
      ids('nonprofit', ['accepting_donations']).includes('charitable_registration'),
  },
  {
    name: 'null/unknown business type returns only universally-applicable items',
    run: () => {
      const got = ids(null)
      return (
        got.includes('ein') &&
        got.includes('state_formation_filing') &&
        !got.includes('nonprofit_501c3_application')
      )
    },
  },
  {
    name: 'EIN item states it is free and warns against paying third parties',
    run: () => {
      const ein = allCostItems().find((i) => i.id === 'ein')
      if (!ein) return false
      const text = `${ein.filingFee} ${ein.professionalCost} ${ein.notes}`.toLowerCase()
      return text.includes('free') && text.includes('never pay') && text.includes('irs.gov')
    },
  },
  {
    name: 'no cost field pins an exact dollar figure (ranges/words only, never a point value)',
    run: () =>
      // Enforces the boundary: no "$275", "$500", etc. Everything must read as
      // a word range ("a few hundred dollars") or "free"/"varies", never a
      // hard number that would look like a quote and go stale.
      allCostItems().every((i) => {
        const fields = `${i.filingFee} ${i.professionalCost} ${i.typicalTime} ${i.notes}`
        return !/\$\s?\d/.test(fields) && !/\b\d+\s*(dollars|usd)\b/i.test(fields)
      }),
  },
  {
    name: 'no cost field tells the founder what it "will cost you" (no personalized quote)',
    run: () =>
      allCostItems().every((i) => {
        const fields = `${i.filingFee} ${i.professionalCost} ${i.notes}`
        return (
          !/will cost you/i.test(fields) &&
          !/your (total )?cost (is|will be)/i.test(fields) &&
          !/you will (pay|spend)/i.test(fields)
        )
      }),
  },
  {
    name: 'every cost item has a non-empty verify-at source',
    run: () => allCostItems().every((i) => i.verifyAt.trim().length > 0),
  },
  {
    name: 'every cost item id is unique',
    run: () => {
      const list = allCostItems()
      return new Set(list.map((i) => i.id)).size === list.length
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
