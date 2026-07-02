import { buildNameSearch, buildNameSearchLinks, NAME_SEARCH_DISCLAIMER } from '../lib/nameSearch'

interface Case {
  name: string
  run: () => boolean
}

// Words this feature must never use to assert a conclusion about the name.
const FORBIDDEN_ASSERTIONS = ['is available', 'is clear', 'is safe', 'is approved', 'no conflict']

function allText(links: ReturnType<typeof buildNameSearchLinks>, extra: string[] = []): string {
  return [
    ...links.map(l => `${l.label} ${l.note}`),
    ...extra,
  ].join(' ').toLowerCase()
}

const cases: Case[] = [
  {
    name: 'always includes USPTO trademark search and Google Patents links',
    run: () => {
      const links = buildNameSearchLinks('Acme Robotics')
      const ids = links.map(l => l.id)
      return ids.includes('uspto-trademark') && ids.includes('google-patents')
    },
  },
  {
    name: 'includes a Google Patents link with the name URL-encoded in the query',
    run: () => {
      const links = buildNameSearchLinks('Acme & Sons')
      const patents = links.find(l => l.id === 'google-patents')
      return !!patents && patents.url.includes(encodeURIComponent('Acme & Sons'))
    },
  },
  {
    name: 'includes IRS Tax Exempt Organization Search for a nonprofit',
    run: () => {
      const links = buildNameSearchLinks('Helping Hands', { businessType: 'nonprofit' })
      return links.some(l => l.id === 'irs-eo-search')
    },
  },
  {
    name: 'includes IRS Tax Exempt Organization Search when business type is unknown',
    run: () => {
      const links = buildNameSearchLinks('Helping Hands', { businessType: null })
      return links.some(l => l.id === 'irs-eo-search')
    },
  },
  {
    name: 'omits IRS Tax Exempt Organization Search for a for-profit product business',
    run: () => {
      const links = buildNameSearchLinks('Acme Robotics', { businessType: 'product' })
      return !links.some(l => l.id === 'irs-eo-search')
    },
  },
  {
    name: 'omits IRS Tax Exempt Organization Search for a consulting business',
    run: () => {
      const links = buildNameSearchLinks('Acme Consulting', { businessType: 'consulting' })
      return !links.some(l => l.id === 'irs-eo-search')
    },
  },
  {
    name: 'uses a direct state registry link for a known state (Delaware)',
    run: () => {
      const links = buildNameSearchLinks('Acme Robotics', { state: 'Delaware' })
      const registry = links.find(l => l.id === 'state-registry')
      return !!registry && registry.url.includes('delaware.gov') && registry.label.includes('Delaware')
    },
  },
  {
    name: 'falls back to a search link (not a guessed URL) for an unlisted state',
    run: () => {
      const links = buildNameSearchLinks('Acme Robotics', { state: 'Rhode Island' })
      const registry = links.find(l => l.id === 'state-registry')
      return !!registry && registry.url.startsWith('https://www.google.com/search?q=')
    },
  },
  {
    name: 'omits the state registry link entirely when no state is given',
    run: () => {
      const links = buildNameSearchLinks('Acme Robotics')
      return !links.some(l => l.id === 'state-registry')
    },
  },
  {
    name: 'buildNameSearch returns the exact required disclaimer text verbatim',
    run: () => {
      const result = buildNameSearch('Acme Robotics')
      return result.disclaimer === NAME_SEARCH_DISCLAIMER &&
        NAME_SEARCH_DISCLAIMER === "This is an early research tool, not a trademark clearance opinion. Similar results do not automatically mean you cannot use a name, and no results do not mean the name is safe. A trademark attorney should review before you spend money on branding, file a trademark application, or launch publicly."
    },
  },
  {
    name: 'buildNameSearch includes guidance and lawyer questions',
    run: () => {
      const result = buildNameSearch('Acme Robotics')
      return result.guidance.length > 0 && result.lawyerQuestions.length > 0
    },
  },
  {
    name: 'never asserts a name is available, clear, safe, approved, or conflict-free',
    run: () => {
      const result = buildNameSearch('Acme Robotics', { state: 'Delaware', businessType: 'nonprofit' })
      const text = allText(result.links, [...result.guidance, ...result.lawyerQuestions])
      return !FORBIDDEN_ASSERTIONS.some(phrase => text.includes(phrase))
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
