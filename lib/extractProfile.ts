import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage } from './chat'
import type { FounderProfile } from './founderProfile'

let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

const SYSTEM_PROMPT = `You extract a structured FounderProfile from a conversation between a student founder and a legal-basics assistant.

Rules:
- Only fill in a field if the conversation explicitly supports it. If something was never discussed, leave it null (or an empty array/string). Never invent or guess values.
- Normalize natural language into numbers. "The three of us split evenly" means three founders each at 33.3 equity_pct. "60/40 between me and my co-founder" means one founder at 60 and one at 40. Percentages across all founders should reflect what was actually said, not be forced to round numbers.
- Each founder needs a name if one was given (use "Founder 1", "Founder 2", etc. only if the person is referred to but never named).
- registered, handles_user_data, and has_ip are booleans only when explicitly stated; otherwise null.`

const FOUNDER_PROFILE_TOOL: Anthropic.Tool = {
  name: 'extract_founder_profile',
  description: 'Record the structured founder profile extracted from the conversation so far.',
  input_schema: {
    type: 'object',
    properties: {
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

export async function extractProfile(messages: ChatMessage[]): Promise<FounderProfile> {
  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
    tools: [FOUNDER_PROFILE_TOOL],
    tool_choice: { type: 'tool', name: 'extract_founder_profile' },
  })

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  )
  const input = (toolUse?.input ?? {}) as Partial<FounderProfile>

  return {
    product_description: input.product_description ?? '',
    business_type: input.business_type ?? null,
    founders: input.founders ?? [],
    registered: input.registered ?? null,
    structure: input.structure ?? null,
    state: input.state ?? null,
    handles_user_data: input.handles_user_data ?? null,
    has_ip: input.has_ip ?? null,
    taking_money_from: input.taking_money_from ?? null,
    recommended_documents: input.recommended_documents ?? [],
    confirmed_documents: input.confirmed_documents ?? [],
  }
}
