import type { BusinessType } from './founderProfile'

// Educational deadline explainer. Deterministic and reference-grounded — no
// LLM call at runtime. Same discipline as lib/beforeYouSignChecklist.ts: a
// curated, keyed dataset plus a selection function, so the output is stable,
// testable, and can't drift into advice on a bad model day.
//
// Hard boundary (mirrors Explain This Form and the cost estimator): this
// describes TYPICAL deadlines for educational purposes only. It never says
// "your deadline is <date>," never computes a personalized due date, and
// never tells the founder they have or haven't missed anything. Every window
// is framed as "the typical window is X — confirm the current rule and your
// specific dates with a professional." Missing a real deadline has real
// consequences, and only a licensed professional who knows the founder's
// facts can give them their actual dates.

export type Situation =
  | 'has_equity' // founders/employees hold stock subject to vesting
  | 's_corp_election' // considering S-corp tax treatment
  | 'delaware' // incorporated in Delaware
  | 'accepting_donations' // nonprofit soliciting charitable contributions
  | 'hiring' // has or plans to have employees

export interface Deadline {
  id: string
  title: string
  // The typical timeframe, stated as a window rather than a specific date.
  typicalWindow: string
  whatItIs: string
  // Why the window matters — the educational "here's what missing it can
  // mean" framing, never "you will be penalized."
  whyItMatters: string
  // Where to confirm the current rule and the founder's own dates.
  verifyAt: string
  appliesTo: BusinessType[]
  // Optional extra gating: only surfaces when the founder's situation matches.
  situations?: Situation[]
}

// Required verbatim, enforced in code rather than left to a model or to the
// UI. Every rendered deadline list must carry this line.
export const DEADLINE_DISCLAIMER =
  'These are typical, educational timeframes — not your personal deadlines. Rules and dates change and depend on your specific situation, so confirm the current requirement and your own dates with a licensed attorney or CPA before you rely on any of them.'

const DEADLINES: Deadline[] = [
  {
    id: 'section_83b',
    title: '83(b) election',
    typicalWindow:
      'Typically must be filed with the IRS within 30 days of receiving or purchasing restricted stock. This window is famously unforgiving — there is generally no extension.',
    whatItIs:
      'A one-page election that asks the IRS to tax restricted stock at its (usually low) value now, rather than as it vests later.',
    whyItMatters:
      'Founders and early employees who miss the roughly 30-day window can face a much larger tax bill as their equity vests and grows in value. Because there is usually no way to file late, this is one of the most consequential early deadlines.',
    verifyAt: 'irs.gov and a startup-focused CPA or attorney',
    appliesTo: ['product', 'consulting'],
    situations: ['has_equity'],
  },
  {
    id: 's_corp_election_2553',
    title: 'S-corporation election (Form 2553)',
    typicalWindow:
      'To apply for the current tax year, Form 2553 is generally due no more than 2 months and 15 days after the start of that tax year (there are limited late-election relief provisions).',
    whatItIs:
      'The IRS form a corporation or LLC files to be taxed as an S-corporation.',
    whyItMatters:
      'Miss the window and the S-corp tax treatment usually will not take effect until the following tax year, which can change the founders’ tax picture for a full year.',
    verifyAt: 'irs.gov and a CPA',
    appliesTo: ['product', 'consulting'],
    situations: ['s_corp_election'],
  },
  {
    id: 'form_1023',
    title: '501(c)(3) exemption application (Form 1023 / 1023-EZ)',
    typicalWindow:
      'Typically filed within 27 months of the end of the month in which the nonprofit was legally formed, so that tax-exempt status can apply retroactively to the formation date.',
    whatItIs:
      'The application a nonprofit files with the IRS to be recognized as a 501(c)(3) tax-exempt organization.',
    whyItMatters:
      'File within the typical 27-month window and exemption can reach back to formation; file later and exemption often only starts from the application date, which can affect donations and taxes in between.',
    verifyAt: 'irs.gov and a nonprofit attorney or CPA',
    appliesTo: ['nonprofit'],
  },
  {
    id: 'form_990',
    title: 'Annual nonprofit return (Form 990 / 990-EZ / 990-N)',
    typicalWindow:
      'Typically due by the 15th day of the 5th month after the end of the organization’s fiscal year. For example, an organization whose fiscal year ends December 31 would look at a window around mid-May — but your own fiscal year, not this example, determines the date.',
    whatItIs:
      'The annual information return most tax-exempt organizations file with the IRS.',
    whyItMatters:
      'Failing to file the required annual return for three consecutive years generally results in automatic loss of tax-exempt status, which is disruptive and can be costly to reverse.',
    verifyAt: 'irs.gov and a nonprofit CPA',
    appliesTo: ['nonprofit'],
  },
  {
    id: 'charitable_solicitation_registration',
    title: 'Charitable solicitation registration',
    typicalWindow:
      'Many states require registration before you solicit donations from their residents, and then renewal on a recurring (often annual) basis.',
    whatItIs:
      'State-level registration that permits a nonprofit to ask the public for donations.',
    whyItMatters:
      'Soliciting in a state before registering, or letting a renewal lapse, can lead to penalties and can jeopardize the ability to fundraise there. Requirements vary widely from state to state.',
    verifyAt: 'your state charities regulator (often the Attorney General or Secretary of State) and a nonprofit attorney',
    appliesTo: ['nonprofit'],
    situations: ['accepting_donations'],
  },
  {
    id: 'delaware_franchise_tax',
    title: 'Delaware franchise tax & annual report',
    typicalWindow:
      'For Delaware corporations, the annual franchise tax and report are typically due by March 1 — a fixed date the state sets for all corporations, not one tied to your own fiscal year (Delaware LLCs follow a different schedule and amount).',
    whatItIs:
      'An annual fee and report Delaware requires to keep an entity in good standing — separate from income tax.',
    whyItMatters:
      'Late payment typically triggers penalties and interest, and prolonged non-payment can put the entity out of good standing. The first year’s bill can also be surprisingly large under the default calculation method.',
    verifyAt: 'the Delaware Division of Corporations (corp.delaware.gov) and a CPA',
    appliesTo: ['product', 'consulting'],
    situations: ['delaware'],
  },
  {
    id: 'state_annual_report',
    title: 'State annual (or biennial) report',
    typicalWindow:
      'Most states require corporations, LLCs, and nonprofits to file a report on a recurring schedule — annually or every two years — often tied to the formation anniversary or a fixed calendar date.',
    whatItIs:
      'A periodic filing (sometimes called a Statement of Information) that keeps your registered agent and company details current with the state.',
    whyItMatters:
      'Missing it commonly leads to late fees and, if ignored, administrative dissolution of the entity. Deadlines and fees differ significantly by state.',
    verifyAt: 'your state’s Secretary of State and a business attorney or CPA',
    appliesTo: ['product', 'consulting', 'nonprofit'],
  },
  {
    id: 'federal_income_tax_return',
    title: 'Federal income tax return',
    typicalWindow:
      'The due date depends on the entity type and fiscal year. As a common example, a calendar-year C-corporation’s Form 1120 generally falls around mid-April, while calendar-year partnerships and S-corporations generally fall about a month earlier — but your entity type and fiscal year, not this example, set the actual date. Extensions are usually available but do not extend the time to pay.',
    whatItIs:
      'The annual federal income tax return for the business entity.',
    whyItMatters:
      'Filing or paying late generally triggers penalties and interest. An extension to file is not an extension to pay, which surprises many first-time founders.',
    verifyAt: 'irs.gov and a CPA',
    appliesTo: ['product', 'consulting'],
  },
  {
    id: 'quarterly_estimated_taxes',
    title: 'Quarterly estimated taxes',
    typicalWindow:
      'Businesses and individuals with income that is not withheld often owe estimated tax in four installments across the year (commonly around mid-April, mid-June, mid-September, and mid-January).',
    whatItIs:
      'Periodic prepayments of income (and often self-employment) tax for income that has no withholding.',
    whyItMatters:
      'Underpaying across the year can lead to an underpayment penalty even if everything is squared up at filing time.',
    verifyAt: 'irs.gov and a CPA',
    appliesTo: ['product', 'consulting'],
  },
  {
    id: 'payroll_tax_deposits',
    title: 'Payroll tax deposits & filings',
    typicalWindow:
      'Once you have employees, federal payroll tax deposits follow a set schedule (often monthly or semi-weekly), with periodic returns such as Form 941 typically filed each quarter.',
    whatItIs:
      'The withholding, deposit, and reporting obligations that come with paying employees.',
    whyItMatters:
      'Payroll tax penalties are among the strictest the IRS imposes, and responsible individuals can be held personally liable. This is an area founders almost always hand to a payroll provider or CPA.',
    verifyAt: 'irs.gov, your state tax agency, and a payroll provider or CPA',
    appliesTo: ['product', 'consulting'],
    situations: ['hiring'],
  },
  {
    id: 'boi_report',
    title: 'Beneficial Ownership Information (BOI) report',
    typicalWindow:
      'For companies created in the United States, there is currently no BOI report to file — under an interim final rule, domestic companies and U.S. persons were exempted from the reporting requirement. Only certain companies formed outside the U.S. and registered to do business here still report. This requirement has swung back and forth through litigation and rulemaking, and a further final rule is still expected, so treat the current status as subject to change.',
    whatItIs:
      'A report identifying a company’s beneficial owners, filed with FinCEN (the Treasury’s Financial Crimes Enforcement Network) under the Corporate Transparency Act. FinCEN’s interim final rule (issued in March 2025) narrowed the definition of a “reporting company” to certain foreign-formed entities only.',
    whyItMatters:
      'Because this requirement has repeatedly changed — and domestic companies are, for now, exempt — the important move is not memorizing a deadline but confirming the current status directly before assuming you do or do not have to file.',
    verifyAt: 'fincen.gov/boi and a business attorney (this requirement has changed repeatedly)',
    appliesTo: ['product', 'consulting'],
  },
]

export interface DeadlineResult {
  deadlines: Deadline[]
  disclaimer: string
}

// Selects the educationally relevant deadlines for a founder's entity type and
// situation. Deadlines with no `situations` requirement always apply to their
// entity type; deadlines that list `situations` only surface when at least one
// listed situation is active. An unknown/null business type returns the set
// that is universally relevant (those that apply to every business type),
// rather than nothing, so the founder still sees the broadly-applicable items.
export function selectDeadlines(
  businessType: BusinessType | null,
  situations: Situation[] = [],
): DeadlineResult {
  const active = new Set(situations)

  const matches = DEADLINES.filter((d) => {
    const entityMatch =
      businessType === null
        ? // No entity known: only show deadlines that apply to ALL types, so
          // we never imply a nonprofit-only or for-profit-only deadline is
          // universal.
          (['product', 'consulting', 'nonprofit'] as BusinessType[]).every((t) =>
            d.appliesTo.includes(t),
          )
        : d.appliesTo.includes(businessType)
    if (!entityMatch) return false

    // Situation-gated deadlines only appear when the situation is active.
    if (d.situations && d.situations.length > 0) {
      return d.situations.some((s) => active.has(s))
    }
    return true
  })

  return { deadlines: matches, disclaimer: DEADLINE_DISCLAIMER }
}

// Convenience for tests, counts, and stable orderings. NOTE: this returns the
// raw dataset WITHOUT the mandated educational disclaimer. Any user-facing
// surface must render deadlines via selectDeadlines() (which always attaches
// DEADLINE_DISCLAIMER) or explicitly render DEADLINE_DISCLAIMER alongside the
// list — never ship allDeadlines() output to a user on its own.
export function allDeadlines(): Deadline[] {
  return DEADLINES
}
