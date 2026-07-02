import type { ChatMessage } from './chat'

// Code-level backstop for categories that must never get a substantive answer,
// even if the model would otherwise try to help. Keyword/regex only, no LLM call.
//
// GUARD_CATEGORIES is exported (not just used internally) so other features —
// notably lib/redFlags.ts — can reuse these exact patterns instead of
// re-typing the same regexes with a chance of drifting out of sync.

export interface GuardCategory {
  id: string
  label: string
  patterns: RegExp[]
  response: string
}

const WARM_PREFIX = "I want to make sure you're taken care of here, so I'll be straight with you: "

export const GUARD_CATEGORIES: GuardCategory[] = [
  {
    id: 'criminal',
    label: 'Possible criminal matter',
    patterns: [
      /\bsubpoena\b/i,
      /\bFBI\b/,
      /\bcriminal (charge|charges|investigation|defense)\b/i,
      /\bindict(ed|ment)\b/i,
      /\barrested?\b/i,
      /\blaw enforcement\b/i,
    ],
    response: WARM_PREFIX +
      "this sounds like it could involve a criminal matter, which is outside what I can safely help with. Please contact a criminal defense attorney right away, this isn't something to navigate without one.",
  },
  {
    id: 'active_dispute',
    label: 'Active legal dispute or threat',
    // Active disputes and received legal threats (cease & desist, being sued, infringement claims)
    patterns: [
      /cease[\s-]+(and|&)[\s-]+desist/i,
      /\b(suing|sued|sues|sue)\b.{0,20}\b(me|us)\b/i,
      /\bthreatening to sue\b/i,
      /\bgot served\b/i,
      /\bwrongful termination\b/i,
      /\binfringe(s|ment)?\b/i,
    ],
    response: WARM_PREFIX +
      "this sounds like it's crossed into an active legal dispute or a legal threat, which is outside what I can safely help with. Please talk to a licensed attorney (litigation, securities, IP, or employment, depending on the details) as soon as you can. They can advise on the specifics of your situation and any deadlines that may apply. I can't evaluate the claim, draft a response to it, or tell you who's likely right here.",
  },
  {
    id: 'securities',
    label: 'Securities or fundraising terms',
    patterns: [
      /\bSAFEs?\b/,
      /\bconvertible note\b/i,
      /\bseed round\b/i,
      /\bterm sheet\b/i,
      /\bcap table\b/i,
      /\bpriced round\b/i,
      /\bissuing (equity|shares) to investors\b/i,
    ],
    response: WARM_PREFIX +
      "securities and fundraising terms, like SAFEs, convertible notes, or term sheets, are outside what I can safely help with. Please talk to a startup or securities attorney, they can walk you through what's standard and make sure the terms actually protect you.",
  },
  {
    id: 'immigration',
    label: 'Immigration question',
    patterns: [
      /\bvisa\b/i,
      /\bF-1\b/i,
      /\bH-1B\b/i,
      /\bgreen card\b/i,
      /\bimmigration\b/i,
      /\bwork authorization\b/i,
    ],
    response: WARM_PREFIX +
      "immigration questions are outside what I can safely help with. Please talk to a licensed immigration attorney, they can advise you based on your specific visa status and situation.",
  },
  {
    id: 'tax_strategy',
    label: 'Tax strategy question',
    patterns: [
      /\btax (strategy|burden|planning)\b/i,
      /\bminimize\b[\s\S]{0,25}\btax/i,
      /\bsalary or distributions\b/i,
      /\bs-corp election\b/i,
    ],
    response: WARM_PREFIX +
      "this is a tax strategy question, which is outside what I can safely help with. Please talk to a CPA or tax attorney, they can recommend the right approach for your specific numbers and situation.",
  },
]

// Checks the accumulated user-side conversation (not just the latest turn) so a
// dispute or threat raised earlier in a multi-turn exchange still triggers the gate.
export function detectOutOfScope(messages: ChatMessage[]): string | null {
  const userText = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n')

  for (const category of GUARD_CATEGORIES) {
    if (category.patterns.some((p) => p.test(userText))) return category.response
  }
  return null
}
