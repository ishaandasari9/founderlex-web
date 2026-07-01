import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'

let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

let cachedPrompt: string | null = null

function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  try {
    const path = join(process.cwd(), 'skill', 'SKILL.md')
    cachedPrompt = readFileSync(path, 'utf8')
    return cachedPrompt
  } catch {
    return `You are FounderLex, a friendly legal-basics educator for first-time student founders in the United States.
Explain startup legal basics in plain English. You are NOT a lawyer and do NOT give legal advice.
Every document you help draft is an educational starting point requiring attorney review.
Keep answers concise, warm, and concrete. Use their actual situation in examples.`
  }
}

const FORMAT_RULES = `
REPLY STYLE - follow these exactly, they override everything else:
- Plain conversational text only. No markdown: no **bold**, no *italics*, no # headers, no bullet points, no numbered lists.
- No em dashes (the long dash like this: —). Use a comma or just end the sentence instead.
- Every reply must be one short paragraph: 3 to 5 sentences maximum. Never a wall of text.
- Write like a knowledgeable friend texting. Warm, direct, gets to the point fast.
- If you need to name multiple things, weave them into a sentence naturally, not as a list.`

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function getChatResponse(
  messages: ChatMessage[],
  founderName?: string,
  buildingDesc?: string,
  profileContext?: string,
  referenceContext?: string,
): Promise<string> {
  const contextParts = [
    founderName ? `The founder's name is ${founderName} — use their name naturally once or twice.` : '',
    buildingDesc ? `They described what they're building as: "${buildingDesc}".` : '',
    profileContext || '',
    referenceContext || '',
  ].filter(Boolean)

  const base = getSystemPrompt()
  const contextLine = contextParts.length ? `\n\n[Session context: ${contextParts.join(' ')}]` : ''
  const system = base + contextLine + FORMAT_RULES

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    system,
    messages,
  })

  const block = response.content[0]
  const raw = block.type === 'text' ? block.text : ''
  return raw
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
}
