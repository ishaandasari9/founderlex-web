import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage } from './chat'
import { emptyProfile, type FounderProfile } from './founderProfile'

let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

const SYSTEM_PROMPT = `You maintain a structured FounderProfile for a student founder talking to a legal-basics assistant. You are given the profile as known so far, plus the latest exchange. Update it — do not rebuild it from scratch.

Rules:
- Preserve every existing field exactly as given unless the latest exchange adds new information or explicitly corrects something. Never drop a fact that was already established.
- Only fill in or change a field if the latest exchange explicitly supports it. If something isn't mentioned, leave the existing value (or null/empty if it was never known). Never invent or guess values.
- Normalize natural language into numbers. "The three of us split evenly" means three founders each at 33.3 equity_pct. "60/40 between me and my co-founder" means one founder at 60 and one at 40.
- Record equity_pct exactly as stated, even if the numbers don't add up to 100 (e.g. three founders who each say "I get 50 percent" get recorded as 50/50/50). Do NOT silently correct, round, or renormalize a math error you notice — record it as-is. Catching bad math is a downstream validation step, not yours.
- Each founder needs a name if one was given (use "Founder 1", "Founder 2", etc. only if the person is referred to but never named).
- Capture company_name only if a specific company/product name was actually given (not a generic description); otherwise null.
- registered, handles_user_data, and has_ip are booleans only when explicitly stated; otherwise null.
- Always return the complete profile object, including all fields that carry over unchanged.`

const FOUNDER_PROFILE_TOOL: Anthropic.Tool = {
  name: 'extract_founder_profile',
  description: 'Record the structured founder profile extracted from the conversation so far.',
  input_schema: {
    type: 'object',
    properties: {
      company_name: { type: ['string', 'null'], description: 'The company/product name, only if explicitly given.' },
      product_description: { type: 'string', description: 'What the founders are building, in their own words. Empty string if not discussed.' },
      business_type: { type: ['string', 'null'], enum: ['product', 'consulting', 'nonprofit', null] },
      founders: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            equity_pct: { type: 'number' },
            role: { type: 'string' },
            commitment: { type: 'string', description: 'e.g. full-time, part-time, advisor' },
          },
          required: ['name', 'equity_pct', 'role', 'commitment'],
        },
      },
      registered: { type: ['boolean', 'null'] },
      structure: { type: ['string', 'null'], description: 'e.g. Delaware C-corp, LLC' },
      state: { type: ['string', 'null'] },
      handles_user_data: { type: ['boolean', 'null'] },
      has_ip: { type: ['boolean', 'null'] },
      taking_money_from: { type: ['string', 'null'], description: 'e.g. friends and family, angel investors, VC' },
      recommended_documents: { type: 'array', items: { type: 'string' } },
      confirmed_documents: { type: 'array', items: { type: 'string' } },
    },
    required: [
      'company_name',
      'product_description',
      'business_type',
      'founders',
      'registered',
      'structure',
      'state',
      'handles_user_data',
      'has_ip',
      'taking_money_from',
      'recommended_documents',
      'confirmed_documents',
    ],
  },
}

export async function extractProfile(
  messages: ChatMessage[],
  existingProfile?: FounderProfile | null,
): Promise<FounderProfile> {
  const base = existingProfile ?? emptyProfile()

  // Bound the extraction call to the latest exchange rather than resending the
  // whole (ever-growing) transcript: the existing profile already carries
  // everything from earlier turns, so only the newest facts need extracting.
  const lastUserIndex = findLastIndex(messages, (m) => m.role === 'user')
  const lastUserMessage = lastUserIndex >= 0 ? messages[lastUserIndex] : null
  const priorAssistantMessage = lastUserIndex > 0
    ? [...messages.slice(0, lastUserIndex)].reverse().find((m) => m.role === 'assistant')
    : undefined

  if (!lastUserMessage) return base

  const system = [
    SYSTEM_PROMPT,
    `\nProfile known so far:\n${JSON.stringify(base)}`,
    priorAssistantMessage ? `\nFor context, the assistant had just said: "${priorAssistantMessage.content}"` : '',
  ].join('')

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: lastUserMessage.content }],
    tools: [FOUNDER_PROFILE_TOOL],
    tool_choice: { type: 'tool', name: 'extract_founder_profile' },
  })

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  )
  const input = (toolUse?.input ?? {}) as Partial<FounderProfile>

  // Merge invariant (see SYSTEM_PROMPT): "Never drop a fact that was already
  // established." The `??` operator only guards null/undefined — it does NOT
  // guard an empty string or empty array. So if a later turn doesn't mention
  // an already-known field and the model returns "" (the tool describes
  // product_description as "Empty string if not discussed") or [] for it, a
  // plain `?? base` would keep that empty value and silently wipe the
  // established fact — e.g. the founders list or the product description
  // vanishing mid-conversation, which then breaks document generation. For
  // string/array fields, fall back to base whenever the incoming value is
  // empty, not just when it's null. Booleans keep `??` on purpose: `false`
  // is a real, established value and only `null` means "unknown".
  return {
    company_name: keepIfEmptyStr(input.company_name, base.company_name),
    product_description: keepIfEmptyStr(input.product_description, base.product_description),
    business_type: input.business_type ?? base.business_type,
    founders: keepIfEmptyArr(input.founders, base.founders),
    registered: input.registered ?? base.registered,
    structure: keepIfEmptyStr(input.structure, base.structure),
    state: keepIfEmptyStr(input.state, base.state),
    handles_user_data: input.handles_user_data ?? base.handles_user_data,
    has_ip: input.has_ip ?? base.has_ip,
    taking_money_from: keepIfEmptyStr(input.taking_money_from, base.taking_money_from),
    recommended_documents: keepIfEmptyArr(input.recommended_documents, base.recommended_documents),
    confirmed_documents: keepIfEmptyArr(input.confirmed_documents, base.confirmed_documents),
  }
}

// Fall back to `base` unless `next` carries a real value. Unlike `??`, an
// empty string (or a whitespace-only string) counts as "no value" and keeps
// the established base fact rather than overwriting it with emptiness.
function keepIfEmptyStr<T extends string | null>(next: string | null | undefined, base: T): string | T {
  return typeof next === 'string' && next.trim() !== '' ? next : base
}

// Same idea for arrays: an empty array means "nothing new this turn", so keep
// whatever was already established rather than clearing it.
function keepIfEmptyArr<T>(next: T[] | undefined, base: T[]): T[] {
  return Array.isArray(next) && next.length > 0 ? next : base
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i
  }
  return -1
}
