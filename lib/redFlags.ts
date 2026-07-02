import { GUARD_CATEGORIES } from './outOfScopeGuard'

export interface RedFlag {
  id: string
  label: string
  whyItMatters: string
  talkTo: string
}

// Plain-English context for the categories outOfScopeGuard.ts already hard-
// stops the chat on. The regex patterns live there and only there — this maps
// each existing category id to the extra copy a warning card needs, so the
// detection logic itself is never duplicated.
const GUARD_FLAG_INFO: Record<string, { whyItMatters: string; talkTo: string }> = {
  criminal: {
    whyItMatters: 'This sounds like it could involve a criminal matter. FounderLex only covers civil startup-legal basics and can\'t help here.',
    talkTo: 'a criminal defense attorney, right away',
  },
  active_dispute: {
    whyItMatters: "This sounds like an active legal dispute or a threat you've already received, like a cease-and-desist letter. Responding wrong, or too slowly, can make things worse.",
    talkTo: 'a litigation attorney (or an IP or employment attorney, depending on the details)',
  },
  securities: {
    whyItMatters: 'Fundraising terms like SAFEs, convertible notes, or term sheets involve securities law. Getting the terms wrong can create serious, hard-to-undo problems for the company and for founders personally.',
    talkTo: 'a startup or securities attorney',
  },
  immigration: {
    whyItMatters: 'Visa and work-authorization rules are strict and specific to your status. A mistake here can affect your ability to stay or work in the US.',
    talkTo: 'a licensed immigration attorney',
  },
  tax_strategy: {
    whyItMatters: 'How you take money out of the business (salary vs. distributions, S-corp elections, and similar choices) has real tax consequences that depend on your specific numbers.',
    talkTo: 'a CPA or tax attorney',
  },
}

// Categories FounderLex does help explain, but that still deserve a visible
// warning because a mistake here is expensive or hard to undo. These are
// intentionally separate from GUARD_CATEGORIES: they surface a warning card,
// they don't shut down the conversation the way the hard-stop guard does.
interface SoftFlagRule {
  id: string
  label: string
  patterns: RegExp[]
  whyItMatters: string
  talkTo: string
}

const SOFT_FLAG_RULES: SoftFlagRule[] = [
  {
    id: 'university_ip',
    label: 'University-owned IP',
    patterns: [
      /\buniversity\b/i,
      /\bmy (school|college)\b/i,
      /\bcampus (lab|resources|equipment)\b/i,
      /\b(lab|research) (equipment|funding|resources)\b/i,
      /\bgrant funding\b/i,
      /\b(professor|advisor)'?s? lab\b/i,
    ],
    whyItMatters: "If you used university resources, like a lab, equipment, computing, faculty advising, or grant funding, to build this, many university IP policies claim ownership of what you built, even though you're the one who built it.",
    talkTo: "your university's tech transfer or IP office, and a startup attorney before assuming you own it",
  },
  {
    id: 'minors',
    label: 'Minors involved',
    patterns: [
      /\bminors?\b/i,
      /\bunder 18\b/i,
      /\b(under|below) the age of 18\b/i,
      /\bchild(ren)? (user|users|account|accounts)\b/i,
      /\bCOPPA\b/,
    ],
    whyItMatters: 'Contracts signed by minors often aren\'t enforceable the normal way, and products aimed at or used by children under 13 trigger extra federal privacy rules (COPPA).',
    talkTo: 'an attorney familiar with contracts involving minors, or privacy/COPPA compliance if children may use your product',
  },
  {
    id: 'worker_classification',
    label: 'Employee vs. contractor classification',
    patterns: [
      /\b1099\b/,
      /\bw-?2\b/i,
      /\bmisclassif/i,
      /\bemployee or contractor\b/i,
      /\bcontractor or employee\b/i,
      /\bfull-?time (help|hire|worker)\b/i,
      /\bhourly employee\b/i,
    ],
    whyItMatters: "Calling someone a contractor doesn't make it legally true. Misclassifying an employee as a contractor can mean back taxes, penalties, and owed benefits, decided by the actual working relationship, not the label in your agreement.",
    talkTo: 'an employment attorney or CPA before finalizing how someone is classified',
  },
  {
    id: 'user_data',
    label: 'Collecting user data',
    patterns: [
      /\b(collect|collecting|store|storing)\b[\s\S]{0,25}\b(user|customer|personal) data\b/i,
      /\bpayment (info|information|details|data)\b/i,
      /\bpersonally identifiable information\b/i,
      /\bPII\b/,
    ],
    whyItMatters: 'Collecting personal data or payment information brings in privacy-law obligations, like needing a real Privacy Policy and possibly state or international rules such as CCPA or GDPR, that go beyond just having good intentions.',
    talkTo: 'a privacy attorney if you handle sensitive data or operate across state or international lines',
  },
  {
    id: 'donations_before_compliance',
    label: 'Taking donations before nonprofit compliance',
    patterns: [
      /\b(accept|accepting|take|taking|collect|collecting)\b[\s\S]{0,20}\bdonations?\b/i,
      /\bfundrais(e|ing)\b[\s\S]{0,20}\bnonprofit\b/i,
      /\btax-?deductible donation/i,
    ],
    whyItMatters: "Donors generally can't claim a tax deduction, and you generally can't promise one, until your nonprofit has actual 501(c)(3) status from the IRS, not just a state-registered nonprofit corporation.",
    talkTo: 'a nonprofit attorney or CPA, to confirm your 501(c)(3) status before soliciting tax-deductible donations',
  },
  {
    id: 'equity_advisor_grants',
    label: 'Equity or advisor share grants',
    patterns: [
      /\badvisor (equity|shares|stock)\b/i,
      /\bequity grant\b/i,
      /\bvesting (schedule|shares)\b/i,
      /\bstock options?\b/i,
      /\b409a\b/i,
      /\bcliff\b[\s\S]{0,20}\bvest/i,
    ],
    whyItMatters: 'Granting equity, even a small advisor grant, involves corporate formalities (board approval, proper documentation, sometimes a 409A valuation) that are easy to skip informally and expensive to fix later.',
    talkTo: 'a startup attorney before finalizing any equity grant',
  },
]

// Runs against a single block of text — a chat message or a generated
// document's filled text — and returns every category that matches. Pure
// and synchronous: no LLM call, same spirit as outOfScopeGuard.ts.
export function detectRedFlags(text: string): RedFlag[] {
  const flags: RedFlag[] = []

  for (const category of GUARD_CATEGORIES) {
    const info = GUARD_FLAG_INFO[category.id]
    if (info && category.patterns.some((p) => p.test(text))) {
      flags.push({ id: category.id, label: category.label, whyItMatters: info.whyItMatters, talkTo: info.talkTo })
    }
  }

  for (const rule of SOFT_FLAG_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      flags.push({ id: rule.id, label: rule.label, whyItMatters: rule.whyItMatters, talkTo: rule.talkTo })
    }
  }

  return flags
}
