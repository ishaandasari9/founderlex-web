import {
  selectDeadlines,
  allDeadlines,
  DEADLINE_DISCLAIMER,
  type Situation,
} from '../lib/deadlineReminders'

interface Case {
  name: string
  run: () => boolean
}

const ids = (bt: Parameters<typeof selectDeadlines>[0], sits: Situation[] = []) =>
  selectDeadlines(bt, sits).deadlines.map((d) => d.id)

const cases: Case[] = [
  {
    name: 'every result carries the educational disclaimer verbatim',
    run: () => selectDeadlines('product').disclaimer === DEADLINE_DISCLAIMER,
  },
  {
    name: 'disclaimer frames these as typical/educational, not personal',
    run: () =>
      DEADLINE_DISCLAIMER.includes('typical') &&
      DEADLINE_DISCLAIMER.toLowerCase().includes('not your personal') &&
      /attorney|cpa|professional/i.test(DEADLINE_DISCLAIMER),
  },
  {
    name: 'nonprofit sees Form 990 and 1023, not 83(b) or S-corp election',
    run: () => {
      const got = ids('nonprofit')
      return (
        got.includes('form_990') &&
        got.includes('form_1023') &&
        !got.includes('section_83b') &&
        !got.includes('s_corp_election_2553')
      )
    },
  },
  {
    name: 'product company does NOT see nonprofit-only deadlines',
    run: () => {
      const got = ids('product')
      return !got.includes('form_990') && !got.includes('form_1023')
    },
  },
  {
    name: '83(b) only surfaces when the founder has equity',
    run: () =>
      !ids('product').includes('section_83b') &&
      ids('product', ['has_equity']).includes('section_83b'),
  },
  {
    name: 'S-corp election only surfaces when that situation is active',
    run: () =>
      !ids('product').includes('s_corp_election_2553') &&
      ids('product', ['s_corp_election']).includes('s_corp_election_2553'),
  },
  {
    name: 'Delaware franchise tax only surfaces when incorporated in Delaware',
    run: () =>
      !ids('product').includes('delaware_franchise_tax') &&
      ids('product', ['delaware']).includes('delaware_franchise_tax'),
  },
  {
    name: 'payroll deposits only surface when hiring',
    run: () =>
      !ids('consulting').includes('payroll_tax_deposits') &&
      ids('consulting', ['hiring']).includes('payroll_tax_deposits'),
  },
  {
    name: 'charitable solicitation only surfaces for nonprofits accepting donations',
    run: () =>
      !ids('nonprofit').includes('charitable_solicitation_registration') &&
      ids('nonprofit', ['accepting_donations']).includes('charitable_solicitation_registration'),
  },
  {
    name: 'state annual report is universal (applies to every business type)',
    run: () =>
      ids('product').includes('state_annual_report') &&
      ids('consulting').includes('state_annual_report') &&
      ids('nonprofit').includes('state_annual_report'),
  },
  {
    name: 'null/unknown business type returns only universally-applicable deadlines',
    run: () => {
      const got = ids(null)
      return (
        got.includes('state_annual_report') &&
        !got.includes('form_990') &&
        !got.includes('federal_income_tax_return')
      )
    },
  },
  {
    name: 'no deadline states a specific personal due date (educational windows only)',
    run: () => {
      // Guard against a data entry that hard-codes "your deadline is <date>".
      // Every window should read as typical/general, so it should not contain
      // an absolute year like 2024/2025/2026 pinned to the founder.
      return allDeadlines().every(
        (d) => !/your deadline is/i.test(d.typicalWindow) && !/\b20\d{2}\b/.test(d.typicalWindow),
      )
    },
  },
  {
    name: 'no deadline claims the founder has already missed or is safe',
    run: () =>
      allDeadlines().every(
        (d) =>
          !/you (have )?missed/i.test(d.whyItMatters) &&
          !/you'?re (fine|safe|good|all set)/i.test(d.whyItMatters),
      ),
  },
  {
    name: 'BOI entry says domestic companies are currently exempt and flags ongoing change',
    run: () => {
      const boi = allDeadlines().find((d) => d.id === 'boi_report')
      if (!boi) return false
      const text = `${boi.typicalWindow} ${boi.whatItIs} ${boi.whyItMatters} ${boi.verifyAt}`
      return (
        /exempt|no BOI report to file/i.test(text) &&
        /change|flux|subject to change|expected/i.test(text)
      )
    },
  },
  {
    name: 'every deadline has a non-empty verify-at source',
    run: () => allDeadlines().every((d) => d.verifyAt.trim().length > 0),
  },
  {
    name: 'every deadline id is unique',
    run: () => {
      const list = allDeadlines()
      return new Set(list.map((d) => d.id)).size === list.length
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
