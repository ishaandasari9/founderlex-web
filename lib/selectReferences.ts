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
    keywords: ['llc', 'c-corp', 'c corp', 's-corp', 's corp', 'sole proprietorship', 'partnership', 'incorporate', 'entity type', 'business structure'],
  },
  {
    file: 'liability-basics.md',
    keywords: ['liability', 'sued', 'lawsuit', 'personal assets', 'liable', 'piercing the corporate veil'],
  },
  {
    file: 'contracts-basics.md',
    keywords: ['binding', 'breach of contract', 'enforceable', 'verbal agreement', 'what makes a contract'],
  },
  {
    file: 'compliance-basics.md',
    keywords: ['ein', 'business license', 'permit', 'registered agent', 'franchise tax', 'annual report filing'],
  },
  {
    file: 'consulting-basics.md',
    keywords: ['statement of work', ' sow ', 'purchase order', 'scope creep', 'worker classification', 'consulting agreement'],
  },
  {
    file: 'nonprofit-basics.md',
    keywords: ['501(c)(3)', '501c3', 'bylaws', 'board of directors', 'conflict of interest', 'form 1023', 'form 990', 'donation acknowledgment', 'donation receipt', 'charitable contribution receipt'],
  },
]

const BUSINESS_TYPE_DEFAULT: Partial<Record<BusinessType, string>> = {
  consulting: 'consulting-basics.md',
  nonprofit: 'nonprofit-basics.md',
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
