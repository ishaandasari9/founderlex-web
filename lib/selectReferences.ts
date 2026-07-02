import type { BusinessType } from './founderProfile'

const MAX_FILES = 2

interface TopicRule {
  file: string
  keywords: string[]
}

const TOPIC_RULES: TopicRule[] = [
  {
    file: 'ip-basics.md',
    keywords: ['trademark', 'copyright', 'patent', 'trade secret', 'nda', 'non-disclosure', 'intellectual property', ' ip ', 'logo', 'brand name', 'invention'],
  },
  {
    file: 'business-structures.md',
    // 'venture capital' added (A1 accuracy benchmark, Codex audit): a founder
    // asking what structure to use for a VC raise is exactly what this file
    // covers ("the standard structure expected by venture capital
    // investors"), but previously matched no keyword at all.
    keywords: ['llc', 'c-corp', 'c corp', 's-corp', 's corp', 'sole proprietorship', 'partnership', 'incorporate', 'entity type', 'business structure', 'venture capital'],
  },
  {
    file: 'liability-basics.md',
    // 'in my own name' / 'sign personally' added (A1 accuracy benchmark,
    // Codex audit): the file's core "sign in the company's name, not
    // personally, to keep the liability shield" guidance previously had no
    // matching keyword.
    keywords: ['liability', 'sued', 'lawsuit', 'personal assets', 'liable', 'piercing the corporate veil', 'in my own name', 'sign personally'],
  },
  {
    file: 'contracts-basics.md',
    keywords: ['binding', 'breach of contract', 'enforceable', 'verbal agreement', 'what makes a contract'],
  },
  {
    file: 'compliance-basics.md',
    // 'done with paperwork' / 'ongoing compliance' added (A1 accuracy
    // benchmark, Codex audit fix follow-up): a question like "am I done
    // with paperwork after forming my LLC?" previously matched only
    // business-structures.md's 'llc' keyword, missing this file's actual
    // "Ongoing Compliance Once Formed" section, which is what the question
    // is really asking about.
    keywords: ['ein', 'business license', 'permit', 'registered agent', 'franchise tax', 'annual report filing', 'done with paperwork', 'ongoing compliance'],
  },
  {
    file: 'consulting-basics.md',
    // 'consulting firm' / 'consultant' added (A1 accuracy benchmark, Codex
    // audit): questions phrased around the role ("as a consultant...", "for
    // my consulting firm...") previously matched no keyword unless they
    // also happened to name a specific document type.
    keywords: ['statement of work', ' sow ', 'purchase order', 'scope creep', 'worker classification', 'consulting agreement', 'consulting firm', 'consultant'],
  },
  {
    file: 'nonprofit-basics.md',
    // 'charitable solicitation' / 'solicit donations' / 'taking donations'
    // added (A1 accuracy benchmark, Codex audit), following the same
    // pattern as the existing donation-acknowledgment keywords: pulls in
    // this file even before business_type is known to be 'nonprofit'.
    keywords: ['501(c)(3)', '501c3', 'bylaws', 'board of directors', 'conflict of interest', 'form 1023', 'form 990', 'donation acknowledgment', 'donation receipt', 'charitable contribution receipt', 'charitable solicitation', 'solicit donations', 'taking donations'],
  },
]

const BUSINESS_TYPE_DEFAULT: Partial<Record<BusinessType, string>> = {
  consulting: 'consulting-basics.md',
  nonprofit: 'nonprofit-basics.md',
}

const ALL_TOPIC_KEYWORDS: string[] = TOPIC_RULES.flatMap((rule) => rule.keywords)

// Reused by lib/runtimeVerifier.ts to decide whether an assistant DRAFT is
// substantive enough to need A2 verification (Codex audit: the verifier was
// previously gated on the latest USER message, so a short reply like "yes"
// in an otherwise substantive conversation was misclassified as small talk
// and skipped verification entirely). Deliberately reuses this exact
// keyword set rather than a separate list, so "does this text touch a
// legal topic" stays defined in one place. Same substring-match semantics
// as selectReferenceFiles above.
export function containsLegalTopicKeyword(text: string): boolean {
  const lower = ` ${text.toLowerCase()} `
  return ALL_TOPIC_KEYWORDS.some((kw) => lower.includes(kw))
}

export function selectReferenceFiles(
  businessType: BusinessType | null,
  latestUserMessage: string,
): string[] {
  const lower = ` ${latestUserMessage.toLowerCase()} `
  const files: string[] = []

  for (const rule of TOPIC_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      files.push(rule.file)
    }
  }

  const defaultFile = businessType ? BUSINESS_TYPE_DEFAULT[businessType] : undefined
  if (defaultFile && !files.includes(defaultFile)) {
    files.push(defaultFile)
  }

  return files.slice(0, MAX_FILES)
}
