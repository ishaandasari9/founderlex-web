import type { FounderProfile } from './founderProfile'

// Progress tracker / guided roadmap. Deterministic and derived entirely from
// the FounderProfile the app already persists per session — no new database
// state, no migration. buildRoadmap() is a pure function of the profile, so it
// unit-tests exactly like the other deterministic features (deadlines, cost
// estimator).
//
// Hard boundary: this is an EDUCATIONAL "here's roughly where you are and
// what's typically next" guide, not legal advice and not a complete or
// authoritative checklist. It never tells a founder they are "done,"
// "compliant," or "legally set." Steps the tool cannot actually verify from
// the profile (getting an EIN, tax filings, annual reports) are shown as
// ongoing reference items, never as checked-off milestones, so the tracker
// can't imply a founder has finished something it has no way to know about.

export type StepStatus = 'done' | 'current' | 'upcoming' | 'ongoing'

export interface RoadmapStep {
  id: string
  title: string
  whatItIs: string
  // Educational "what typically comes next / what to confirm" — never a
  // directive that something is legally sufficient.
  nextAction: string
  status: StepStatus
}

export interface Roadmap {
  headline: string
  steps: RoadmapStep[]
  disclaimer: string
}

export const ROADMAP_DISCLAIMER =
  'This roadmap is a general, educational guide based on what you’ve told the tool — not legal advice and not a complete checklist for your situation. The steps, their order, and what each one requires vary by state and circumstances, so confirm what actually applies to you with a licensed attorney or CPA before relying on it.'

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

interface TrackableSpec {
  id: string
  title: string
  whatItIs: string
  nextAction: string
  done: (p: FounderProfile) => boolean
}

interface OngoingSpec {
  id: string
  title: string
  whatItIs: string
  nextAction: (p: FounderProfile) => string
  // Optional: only include this ongoing item when relevant to the profile.
  relevant?: (p: FounderProfile) => boolean
}

const NONPROFIT_TRACKABLE: TrackableSpec[] = [
  {
    id: 'clarify_mission',
    title: 'Get clear on your mission and what the organization does',
    whatItIs:
      'The plain description of your charitable purpose that everything else — incorporation, bylaws, the IRS application — will be built around.',
    nextAction:
      'Once you can state your mission in a sentence or two, you’re ready to think about incorporating.',
    done: (p) => hasText(p.product_description) || hasText(p.company_name),
  },
  {
    id: 'incorporate_nonprofit',
    title: 'Incorporate the nonprofit with your state',
    whatItIs:
      'Filing Articles of Incorporation with your state’s Secretary of State creates the nonprofit corporation. The IRS won’t grant 501(c)(3) status until the organization exists at the state level.',
    nextAction:
      'File Articles of Incorporation with your state (their purpose and dissolution clauses have specific IRS-required language), then move on to governance documents.',
    done: (p) => p.registered === true,
  },
  {
    id: 'governance_documents',
    title: 'Adopt your governance documents',
    whatItIs:
      'Bylaws and a conflict-of-interest policy set out how the board runs the organization. The IRS application asks whether both are in place.',
    nextAction:
      'Adopt bylaws and a conflict-of-interest policy (this tool can draft starting points), then have the board approve them before you apply for tax-exempt status.',
    done: (p) => {
      const c = p.confirmed_documents ?? []
      return c.includes('nonprofit_bylaws') && c.includes('nonprofit_conflict_of_interest')
    },
  },
]

const NONPROFIT_ONGOING: OngoingSpec[] = [
  {
    id: 'apply_tax_exempt',
    title: 'Apply for 501(c)(3) tax-exempt status',
    whatItIs:
      'Form 1023 (or the streamlined 1023-EZ) asks the IRS to recognize the nonprofit as tax-exempt. This tool can’t confirm whether you’ve filed or been approved.',
    nextAction: () =>
      'Filing within about 27 months of formation typically lets exemption apply back to your formation date. Check current eligibility and fees at irs.gov and with a nonprofit CPA.',
  },
  {
    id: 'charitable_registration',
    title: 'Register to fundraise where required',
    whatItIs:
      'Many states require charitable-solicitation registration before you ask their residents for donations, with recurring renewals.',
    nextAction: () =>
      'Check the rules for each state where you plan to solicit before you start, and confirm with your state’s charities regulator.',
    relevant: (p) => hasText(p.taking_money_from),
  },
  {
    id: 'nonprofit_ongoing_compliance',
    title: 'Keep up with ongoing filings',
    whatItIs:
      'Annual obligations like the Form 990 information return and state annual reports keep the organization in good standing. This tool can’t track your specific due dates.',
    nextAction: () =>
      'Missing the annual return for three years in a row generally causes automatic loss of tax-exempt status — confirm your dates with a nonprofit CPA.',
  },
]

const FORPROFIT_TRACKABLE: TrackableSpec[] = [
  {
    id: 'clarify_concept',
    title: 'Get clear on what you’re building',
    whatItIs:
      'A plain description of your product or service — the foundation the structure, documents, and protections are built on.',
    nextAction:
      'Once you can describe what you’re building in a sentence or two, you’re ready to think about a legal structure.',
    done: (p) => hasText(p.product_description) || hasText(p.company_name),
  },
  {
    id: 'choose_structure',
    title: 'Choose a legal structure',
    whatItIs:
      'Whether you operate as an LLC, a corporation, or something else affects taxes, liability, and how you raise money.',
    nextAction:
      'Compare the common structures for your situation (an attorney or CPA can help you weigh them), then register the one you choose.',
    done: (p) => hasText(p.structure),
  },
  {
    id: 'register_with_state',
    title: 'Register your entity with the state',
    whatItIs:
      'Filing formation documents with your state’s Secretary of State creates the legal entity and separates it from you personally.',
    nextAction:
      'File your formation documents with the state, then put your core agreements in place.',
    done: (p) => p.registered === true,
  },
  {
    id: 'core_documents',
    title: 'Put your core agreements in place',
    whatItIs:
      'The foundational documents for your situation — often a founders’ agreement, NDAs, and contractor or IP-assignment agreements — that set expectations before problems arise.',
    nextAction:
      'Work through the documents this tool has recommended for you, and have a lawyer review anything involving money, equity, or IP before you sign.',
    done: (p) => {
      const recommended = p.recommended_documents ?? []
      const confirmed = p.confirmed_documents ?? []
      if (recommended.length > 0) return recommended.every((d) => confirmed.includes(d))
      return confirmed.length > 0
    },
  },
]

const FORPROFIT_ONGOING: OngoingSpec[] = [
  {
    id: 'get_ein',
    title: 'Get an EIN and set up finances',
    whatItIs:
      'An Employer Identification Number (free from the IRS) lets you open a business bank account and handle taxes. This tool can’t confirm whether you have one.',
    nextAction: () =>
      'Apply directly at irs.gov — it’s free, so never pay a third-party site — and keep business finances separate from personal ones.',
  },
  {
    id: 'data_and_ip',
    title: 'Handle data and IP basics',
    whatItIs:
      'If you collect user data or have intellectual property, a privacy policy and clear IP-assignment terms protect you and set expectations.',
    nextAction: (p) => {
      const bits: string[] = []
      if (p.handles_user_data === true)
        bits.push('a privacy policy that matches what you actually collect')
      if (p.has_ip === true) bits.push('written IP-assignment terms so the company owns its work')
      const focus = bits.length > 0 ? bits.join(' and ') : 'a privacy policy and IP-assignment terms if they apply to you'
      return `Consider ${focus}, and confirm specifics with a lawyer.`
    },
  },
  {
    id: 'forprofit_ongoing_compliance',
    title: 'Keep up with ongoing filings',
    whatItIs:
      'Recurring obligations like state annual reports, franchise taxes, and income-tax filings keep the entity in good standing. This tool can’t track your specific due dates.',
    nextAction: () =>
      'Confirm your state’s recurring filings and your tax deadlines with a CPA — they vary by state and entity type.',
  },
]

const GENERIC_TRACKABLE: TrackableSpec[] = [
  {
    id: 'clarify_concept',
    title: 'Get clear on what you’re building',
    whatItIs:
      'A plain description of your idea — the starting point for figuring out structure and documents.',
    nextAction:
      'Tell the tool a bit about what you’re building and whether it’s a product, a consulting practice, or a nonprofit, and the roadmap will get more specific.',
    done: (p) => hasText(p.product_description) || hasText(p.company_name),
  },
  {
    id: 'choose_structure',
    title: 'Choose a legal structure',
    whatItIs:
      'The structure you pick (for-profit entity vs. nonprofit, and which type) shapes nearly everything that follows.',
    nextAction:
      'Decide whether you’re building a for-profit or a nonprofit, then compare the specific structures for that path.',
    done: (p) => hasText(p.structure) || p.business_type !== null,
  },
  {
    id: 'register_with_state',
    title: 'Register your entity with the state',
    whatItIs:
      'Filing formation documents with your state creates the legal entity.',
    nextAction: 'File your formation documents with your state’s Secretary of State.',
    done: (p) => p.registered === true,
  },
]

function trackFor(businessType: FounderProfile['business_type']): {
  trackable: TrackableSpec[]
  ongoing: OngoingSpec[]
} {
  if (businessType === 'nonprofit') return { trackable: NONPROFIT_TRACKABLE, ongoing: NONPROFIT_ONGOING }
  if (businessType === 'product' || businessType === 'consulting')
    return { trackable: FORPROFIT_TRACKABLE, ongoing: FORPROFIT_ONGOING }
  return { trackable: GENERIC_TRACKABLE, ongoing: [] }
}

// Pure function of the profile. A null profile is treated as an empty one so a
// brand-new visitor still gets the starting roadmap rather than nothing. The
// profile is coerced to a known shape first (Codex finding): it comes from
// persisted session storage, which is only size-validated on save, so a
// malformed stored profile (e.g. confirmed_documents that isn't an array)
// must not be able to crash roadmap generation.
export function buildRoadmap(profile: FounderProfile | null): Roadmap {
  const p = coerceProfile(profile)
  const { trackable, ongoing } = trackFor(p.business_type)

  // Done-status is monotonic: a step only counts as done when it AND every
  // earlier step are satisfied (Codex Low finding). This models a roadmap the
  // way a founder actually reads one — you can't be past step 3 while step 2 is
  // unfinished — and avoids an internally inconsistent profile (registered=true
  // but no structure recorded) showing a later milestone as complete while an
  // earlier one is still current.
  const rawDone = trackable.map((s) => s.done(p))
  const effectiveDone: boolean[] = []
  let prefixOk = true
  for (let i = 0; i < trackable.length; i++) {
    prefixOk = prefixOk && rawDone[i]
    effectiveDone.push(prefixOk)
  }
  const doneCount = effectiveDone.filter(Boolean).length

  const firstNotDone = effectiveDone.findIndex((d) => !d)
  const steps: RoadmapStep[] = trackable.map((s, i) => ({
    id: s.id,
    title: s.title,
    whatItIs: s.whatItIs,
    nextAction: s.nextAction,
    status: effectiveDone[i] ? 'done' : i === firstNotDone ? 'current' : 'upcoming',
  }))

  for (const o of ongoing) {
    if (o.relevant && !o.relevant(p)) continue
    steps.push({
      id: o.id,
      title: o.title,
      whatItIs: o.whatItIs,
      nextAction: o.nextAction(p),
      status: 'ongoing',
    })
  }

  return {
    headline: buildHeadline(doneCount, trackable.length),
    steps,
    disclaimer: ROADMAP_DISCLAIMER,
  }
}

function buildHeadline(doneCount: number, total: number): string {
  if (total === 0) return 'Let’s map out where you are.'
  if (doneCount === 0) return `You’re just getting started — here are the first of ${total} core steps.`
  if (doneCount >= total)
    return `You’ve worked through all ${total} of the core setup steps this tool can track — keep the ongoing items below on your radar.`
  return `You’ve completed ${doneCount} of ${total} core setup steps the tool can track. Here’s what’s next.`
}

const BUSINESS_TYPES: ReadonlyArray<string> = ['product', 'consulting', 'nonprofit']

function asStringOrNull(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

function asBoolOrNull(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null
}

// Normalizes an untrusted/persisted profile into the exact shape buildRoadmap
// relies on. Any field of the wrong type is coerced to a safe default, so a
// malformed stored profile yields a sensible (possibly empty) roadmap rather
// than throwing. A null profile becomes a fully-empty profile.
function coerceProfile(profile: FounderProfile | null): FounderProfile {
  const src = (profile ?? {}) as Partial<Record<keyof FounderProfile, unknown>>
  const bt = src.business_type
  return {
    company_name: asStringOrNull(src.company_name),
    product_description: typeof src.product_description === 'string' ? src.product_description : '',
    business_type:
      typeof bt === 'string' && BUSINESS_TYPES.includes(bt)
        ? (bt as FounderProfile['business_type'])
        : null,
    founders: Array.isArray(src.founders) ? (src.founders as FounderProfile['founders']) : [],
    registered: asBoolOrNull(src.registered),
    structure: asStringOrNull(src.structure),
    state: asStringOrNull(src.state),
    handles_user_data: asBoolOrNull(src.handles_user_data),
    has_ip: asBoolOrNull(src.has_ip),
    taking_money_from: asStringOrNull(src.taking_money_from),
    recommended_documents: asStringArray(src.recommended_documents),
    confirmed_documents: asStringArray(src.confirmed_documents),
  }
}
