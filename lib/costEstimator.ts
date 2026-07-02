import type { BusinessType } from './founderProfile'

// Educational cost & time estimator. Deterministic and reference-grounded —
// no LLM call at runtime, same discipline as lib/deadlineReminders.ts and
// lib/beforeYouSignChecklist.ts.
//
// Hard boundary (mirrors the deadline explainer): this gives ROUGH, TYPICAL
// RANGES for general education only. It never produces a personalized quote,
// never says "this is what it will cost you," and never tells the founder
// what to budget. Government fees change and vary by state; attorney costs
// vary enormously by market and complexity. Every figure is a wide range or
// "free"/"varies," paired with a source to confirm the current amount and a
// reminder to get a real quote. Numbers here are deliberately broad and
// approximate, not point estimates — pinning an exact current fee would be
// both wrong over time and outside the educational boundary.

export type CostSituation =
  | 'has_equity' // multiple founders / equity worth papering
  | 'accepting_donations' // nonprofit soliciting charitable contributions
  | 'trademark' // wants to protect a brand name / logo
  | 'hiring' // has or plans to have employees

export interface CostItem {
  id: string
  title: string
  // Government / official filing fee, as a range or "Free" or "Varies by state."
  filingFee: string
  // Typical professional (attorney/CPA) cost range, always framed as "varies"
  // and paired with the DIY reality where one exists.
  professionalCost: string
  // Typical processing / turnaround time, as a range.
  typicalTime: string
  // Caveats, gotchas, and money-saving truths (e.g. an EIN is free from the
  // IRS — never pay a third-party site).
  notes: string
  verifyAt: string
  appliesTo: BusinessType[]
  situations?: CostSituation[]
}

// Required verbatim, enforced in code. Every rendered cost list must carry it.
export const COST_DISCLAIMER =
  'These are rough, typical ranges for general education — not a quote and not an estimate of what your situation will cost. Government fees change often and vary by state, and professional fees vary widely by market and complexity. Confirm the current fee at the official source and get an actual quote from a licensed professional before you budget anything.'

const COST_ITEMS: CostItem[] = [
  {
    id: 'state_formation_filing',
    title: 'Forming the entity with the state (LLC or corporation)',
    filingFee:
      'Varies widely by state — the one-time filing fee is commonly somewhere in the low tens to a few hundred dollars, with a handful of states higher.',
    professionalCost:
      'Many founders file directly with the state themselves for just the state fee. If you use an attorney or a formation service, that typically adds anywhere from a modest flat fee to several hundred dollars or more, depending on how much they do.',
    typicalTime:
      'Often anywhere from same-day (online, some states) to a few weeks by standard processing; many states offer paid expedited options.',
    notes:
      'The state fee and the service/attorney fee are two separate things. You are allowed to file directly with the Secretary of State yourself.',
    verifyAt: 'your state’s Secretary of State website',
    appliesTo: ['product', 'consulting', 'nonprofit'],
  },
  {
    id: 'ein',
    title: 'Employer Identification Number (EIN)',
    filingFee: 'Free.',
    professionalCost:
      'You do not need to pay anyone for this. Third-party sites that charge a fee to "get your EIN" are charging for something the IRS provides at no cost.',
    typicalTime:
      'Often issued immediately when applied for directly online at irs.gov during operating hours; other methods take longer.',
    notes:
      'Apply directly at irs.gov. Never pay a third-party website for an EIN — the IRS issues it for free.',
    verifyAt: 'irs.gov (search "apply for an EIN")',
    appliesTo: ['product', 'consulting', 'nonprofit'],
  },
  {
    id: 'nonprofit_501c3_application',
    title: '501(c)(3) tax-exemption application (Form 1023 / 1023-EZ)',
    filingFee:
      'The IRS charges a user fee to process the application. The streamlined 1023-EZ fee is lower than the full 1023 fee; both are in the range of a few hundred dollars. Confirm the current amounts, as they are updated periodically.',
    professionalCost:
      'Some small nonprofits complete the 1023-EZ themselves; the full Form 1023 is substantial, and many organizations use a nonprofit attorney or specialist, which can run into the hundreds or low thousands depending on complexity.',
    typicalTime:
      'Processing time varies with the IRS’s current backlog. The streamlined 1023-EZ is often faster (frequently weeks to a couple of months) and the full 1023 typically takes longer (often several months or more) — check the IRS’s current processing status rather than treating these as guarantees.',
    notes:
      'Not every organization is eligible for the shorter 1023-EZ — eligibility depends on projected revenue and other factors. Check the current eligibility worksheet.',
    verifyAt: 'irs.gov and a nonprofit attorney or CPA',
    appliesTo: ['nonprofit'],
  },
  {
    id: 'registered_agent',
    title: 'Registered agent',
    filingFee:
      'Not a government fee. If you act as your own registered agent (allowed in many states if you have an in-state address), there is often no separate cost.',
    professionalCost:
      'A commercial registered agent service typically costs somewhere from a few tens to a few hundred dollars per year.',
    typicalTime: 'Set up immediately when you form the entity or switch providers.',
    notes:
      'Required in most states. You can often be your own agent, but a service adds privacy and reliability for receiving legal notices.',
    verifyAt: 'your state’s Secretary of State and any agent service you compare',
    appliesTo: ['product', 'consulting', 'nonprofit'],
  },
  {
    id: 'trademark_registration',
    title: 'Federal trademark registration (USPTO)',
    filingFee:
      'The USPTO charges a government filing fee per class of goods/services — commonly a few hundred dollars per class. The fee structure is updated periodically, so confirm the current amount and classes.',
    professionalCost:
      'Many applicants use a trademark attorney for clearance searching and filing; that typically adds several hundred to over a thousand dollars, separate from the government fee.',
    typicalTime:
      'Registration commonly takes many months from filing to registration, and can be longer if the USPTO issues an office action.',
    notes:
      'A registration covers specific classes of goods/services — filing in more classes costs more. A clearance search before filing helps avoid conflicts.',
    verifyAt: 'uspto.gov and a trademark attorney',
    appliesTo: ['product', 'consulting'],
    situations: ['trademark'],
  },
  {
    id: 'founders_agreement',
    title: 'Founders’ agreement',
    filingFee: 'None — this is a private agreement, not a government filing.',
    professionalCost:
      'A template (like the ones this tool can generate) costs little to nothing; having an attorney draft or review a custom founders’ agreement commonly ranges from a few hundred to a couple thousand dollars depending on complexity.',
    typicalTime: 'A template can be filled in same-day; attorney turnaround varies from days to weeks.',
    notes:
      'When real money, equity, or IP is involved, many founders have an attorney review even a template version before signing.',
    verifyAt: 'a startup attorney for a custom quote',
    appliesTo: ['product', 'consulting'],
    situations: ['has_equity'],
  },
  {
    id: 'annual_state_fees',
    title: 'Annual report & franchise/entity fees',
    filingFee:
      'Recurring state fees vary widely — some states charge a small annual report fee, others (like Delaware) charge a franchise tax that can range from modest to substantial depending on the calculation method.',
    professionalCost:
      'Often handled by you or your CPA/registered agent as part of routine compliance; a service may bundle it into an annual fee.',
    typicalTime: 'Filed on a recurring (often annual) schedule set by the state.',
    notes:
      'Almost every state charges something recurring to keep an entity in good standing, so budget for it wherever you form. As one example, Delaware’s default franchise tax calculation can produce a surprisingly large first bill; an alternate calculation method often lowers it, so check both.',
    verifyAt: 'your state’s Secretary of State and a CPA',
    appliesTo: ['product', 'consulting', 'nonprofit'],
  },
  {
    id: 'charitable_registration',
    title: 'State charitable solicitation registration',
    filingFee:
      'Many states charge a registration and/or renewal fee to solicit donations, ranging from little to a couple hundred dollars per state, sometimes scaled to the amount raised.',
    professionalCost:
      'Registering in many states can be time-consuming; some nonprofits use a service or attorney to manage multi-state registration, which adds a recurring cost.',
    typicalTime:
      'Registration is generally required before soliciting in a state, with recurring (often annual) renewals.',
    notes:
      'Requirements and fees vary a lot state to state, and registering in many states adds up. Prioritize the states where you actually solicit.',
    verifyAt: 'each state’s charities regulator and a nonprofit attorney',
    appliesTo: ['nonprofit'],
    situations: ['accepting_donations'],
  },
  {
    id: 'payroll_setup',
    title: 'Payroll setup & ongoing payroll service',
    filingFee:
      'State payroll/unemployment registration fees are usually small or free; the ongoing cost is the payroll provider, not a government fee.',
    professionalCost:
      'A payroll service commonly costs somewhere from a modest monthly base plus a small per-employee charge; a CPA overseeing it adds to that.',
    typicalTime: 'Provider setup is often quick; state tax account registration can take days to weeks.',
    notes:
      'Payroll tax penalties are strict, so most founders hand payroll to a dedicated provider rather than running it manually.',
    verifyAt: 'your state tax agency and payroll providers you compare',
    appliesTo: ['product', 'consulting'],
    situations: ['hiring'],
  },
]

export interface CostResult {
  items: CostItem[]
  disclaimer: string
}

// Selects the educationally relevant cost items for a founder's entity type and
// situation. Items with no `situations` requirement always apply to their
// entity type; situation-gated items only surface when a listed situation is
// active. An unknown/null business type returns only the universally-applicable
// items (those that apply to every business type), rather than nothing.
export function selectCostItems(
  businessType: BusinessType | null,
  situations: CostSituation[] = [],
): CostResult {
  const active = new Set(situations)

  const items = COST_ITEMS.filter((item) => {
    const entityMatch =
      businessType === null
        ? (['product', 'consulting', 'nonprofit'] as BusinessType[]).every((t) =>
            item.appliesTo.includes(t),
          )
        : item.appliesTo.includes(businessType)
    if (!entityMatch) return false

    if (item.situations && item.situations.length > 0) {
      return item.situations.some((s) => active.has(s))
    }
    return true
  })

  return { items, disclaimer: COST_DISCLAIMER }
}

// Convenience for tests, counts, and stable orderings. NOTE: this returns the
// raw dataset WITHOUT the mandated disclaimer. Any user-facing surface must
// render cost items via selectCostItems() (which always attaches
// COST_DISCLAIMER) or explicitly render COST_DISCLAIMER alongside the list —
// never ship allCostItems() output to a user on its own.
export function allCostItems(): CostItem[] {
  return COST_ITEMS
}
