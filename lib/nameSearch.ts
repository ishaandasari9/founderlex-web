import type { BusinessType } from './founderProfile'

export interface NameSearchLink {
  id: string
  label: string
  url: string
  note: string
}

export interface NameSearchResult {
  query: string
  links: NameSearchLink[]
  guidance: string[]
  lawyerQuestions: string[]
  disclaimer: string
}

// The exact required disclaimer language for this feature. Do not paraphrase —
// this tool must never assert that a name is available, clear, safe, approved,
// or free of conflict.
export const NAME_SEARCH_DISCLAIMER =
  'This is an early research tool, not a trademark clearance opinion. Similar results do not automatically mean you cannot use a name, and no results do not mean the name is safe. A trademark attorney should review before you spend money on branding, file a trademark application, or launch publicly.'

export const NAME_SEARCH_GUIDANCE: string[] = [
  'Look for exact matches first, then close variations: different spelling, added or dropped words, singular vs. plural, and names that sound alike when spoken aloud.',
  "Pay attention to the industry or category each result is in. Trademark protection is tied to specific goods and services, so an identical name in an unrelated field (e.g. a landscaping company vs. a software company) usually matters less than one in your own space.",
  "A live, active registration or filing that's similar and in a related industry is a signal to get a deeper professional search before you invest time or money in the name.",
  'A dead, abandoned, or expired mark still means someone used that name before. It does not block you the way a live mark can, but it can be worth understanding why they stopped using it.',
  "None of these databases are exhaustive — they don't cover unregistered ('common law') use of a name, domain names, or social handles, all of which can still matter."
]

export const TRADEMARK_LAWYER_QUESTIONS: string[] = [
  'Based on what I found, is there anything here that should stop me from using this name?',
  'Should I run a full professional clearance search, beyond these public databases, before I spend money on branding or launch?',
  'Are any of these results close enough that I should consider a different name instead?',
  'What trademark class or classes would my business fall under, and does that change how these results apply?',
]

// Direct links to a state's official business entity search tool, used only
// where we're confident the URL is current. These sites are restructured
// periodically, so this list should be spot-checked occasionally rather than
// treated as permanent.
const STATE_REGISTRY_DIRECT: Record<string, string> = {
  Delaware: 'https://icis.corp.delaware.gov/Ecorp/EntitySearch/NameSearch.aspx',
  California: 'https://bizfileonline.sos.ca.gov/search/business',
  'New York': 'https://apps.dos.ny.gov/publicInquiry/',
  Texas: 'https://mycpa.cpa.state.tx.us/coa/',
  Florida: 'https://search.sunbiz.org/Inquiry/CorporationSearch/ByName',
  Nevada: 'https://www.nvsilverflume.gov/businessSearch',
  Washington: 'https://ccfs.sos.wa.gov/#/BusinessSearch',
  Massachusetts: 'https://corp.sec.state.ma.us/corpweb/CorpSearch/CorpSearch.aspx',
  Illinois: 'https://apps.ilsos.gov/businessentitysearch/',
  Pennsylvania: 'https://file.dos.pa.gov/search/business',
  Georgia: 'https://ecorp.sos.ga.gov/BusinessSearch',
  'North Carolina': 'https://www.sosnc.gov/online_services/search/by_title/_Business_Registration',
  Colorado: 'https://www.coloradosos.gov/biz/BusinessEntityCriteriaExt.do',
  Arizona: 'https://ecorp.azcc.gov/EntitySearch/Index',
  Ohio: 'https://businesssearch.ohiosos.gov/',
}

function stateRegistryLink(state: string | null | undefined): { url: string; isDirect: boolean; state: string } | null {
  const trimmed = state?.trim()
  if (!trimmed) return null
  const direct = STATE_REGISTRY_DIRECT[trimmed]
  if (direct) return { url: direct, isDirect: true, state: trimmed }
  const q = encodeURIComponent(`${trimmed} Secretary of State business entity search`)
  return { url: `https://www.google.com/search?q=${q}`, isDirect: false, state: trimmed }
}

export function buildNameSearchLinks(
  name: string,
  opts: { state?: string | null; businessType?: BusinessType | null } = {}
): NameSearchLink[] {
  const trimmedName = name.trim()
  const links: NameSearchLink[] = [
    {
      id: 'uspto-trademark',
      label: 'USPTO Trademark Search',
      url: 'https://www.uspto.gov/trademarks/search',
      note: `Search for "${trimmedName}" and close variations. Check both live and dead/abandoned marks — a dead mark can still create real-world confusion even though it's no longer legally registered.`,
    },
    {
      id: 'google-patents',
      label: 'Google Patents',
      url: `https://patents.google.com/?q=${encodeURIComponent(trimmedName)}`,
      note: `Mainly useful if your name doubles as a product name. Patents protect inventions rather than names, but this can surface other companies already using the name for a similar product.`,
    },
  ]

  if (opts.businessType !== 'product' && opts.businessType !== 'consulting') {
    links.push({
      id: 'irs-eo-search',
      label: 'IRS Tax Exempt Organization Search',
      url: 'https://apps.irs.gov/app/eos/',
      note: `Search for "${trimmedName}" to see if another nonprofit already uses this name or something close to it. Two nonprofits with confusingly similar names can create real donor confusion even without a trademark conflict.`,
    })
  }

  const registry = stateRegistryLink(opts.state)
  if (registry) {
    links.push({
      id: 'state-registry',
      label: registry.isDirect ? `${registry.state} Business Entity Search` : `Find ${registry.state}'s business registry`,
      url: registry.url,
      note: registry.isDirect
        ? `Search for "${trimmedName}" to see if another registered business in ${registry.state} already has this name or one confusingly close to it.`
        : `We don't have a direct link for ${registry.state} yet, so this searches for it. Look for that state's official Secretary of State (or equivalent) business entity search tool.`,
    })
  }

  return links
}

export function buildNameSearch(
  name: string,
  opts: { state?: string | null; businessType?: BusinessType | null } = {}
): NameSearchResult {
  return {
    query: name.trim(),
    links: buildNameSearchLinks(name, opts),
    guidance: NAME_SEARCH_GUIDANCE,
    lawyerQuestions: TRADEMARK_LAWYER_QUESTIONS,
    disclaimer: NAME_SEARCH_DISCLAIMER,
  }
}
