import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import { detectOutOfScope } from './outOfScopeGuard'
import { containsForbiddenAssertion } from './forbiddenAssertions'

let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

let cachedPrompt: string | null = null

export function getSystemPrompt(): string {
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

// Shown in place of a reply that trips the forbidden-assertion backstop
// below. Deliberately doesn't itself contain any risky "safe/fine/sign"
// phrasing that could re-trigger the same check.
const CHAT_SAFE_FALLBACK =
  "I don't want to overstate that last answer, so let me back up: please don't treat what I just said as a guarantee, and check the specifics with a licensed attorney before relying on it."

// Code-level backstop, independent of the system prompt: runs after every
// substantive chat reply, before it's ever returned to a caller. Reuses the
// shared containsForbiddenAssertion scan (also used by lib/explainForm.ts
// and lib/redFlags.ts) rather than forking a second copy of the pattern
// list, per Codex audit finding — a jailbreak or an unusual model phrasing
// (e.g. "the wall usually holds up fine" for LLC liability) that implies a
// guaranteed legal outcome must never reach the user, even if the system
// prompt's instructions get talked around.
//
// The check runs on the fully formatted, display-ready text (markdown/dash
// stripping already applied), matching lib/explainForm.ts's
// finalizeExplanation convention: the check and what a reader actually sees
// must be exactly the same string.
export function finalizeChatResponse(raw: string): string {
  const formatted = raw
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#+\s+/gm, '')

  if (containsForbiddenAssertion(formatted)) return CHAT_SAFE_FALLBACK
  return formatted
}

// Unlike /api/explain (which has an explicit 20k-char cap for a one-time
// document paste), chat previously had no size limit at all — a single
// oversized message, sent directly to the API without going through the UI,
// costs real money and also gets run through extractProfile's own separate
// LLM call before getChatResponse is ever reached.
export const MAX_MESSAGE_CHARS = 4000
export const MAX_TOTAL_CHARS = 40000
export const MAX_MESSAGE_COUNT = 50

export type ValidateChatInputResult =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; error: string }

// Takes the parsed-but-untyped request body (not already-cast ChatMessage[])
// so shape is actually verified rather than assumed. The prior version only
// checked (m?.content ?? '').length, which silently passed anything without
// a string .length — a number, an object, or a huge nested structure — since
// `undefined > MAX_MESSAGE_CHARS` is always false. That non-string content
// would then flow straight into the Anthropic API call unvalidated.
export function validateChatInput(input: unknown): ValidateChatInputResult {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: 'No message provided.' }
  }

  if (input.length > MAX_MESSAGE_COUNT) {
    return {
      ok: false,
      error: `Too many messages in one request (${input.length.toLocaleString()}, limit ${MAX_MESSAGE_COUNT}). Try starting a new conversation.`,
    }
  }

  const messages: ChatMessage[] = []
  let total = 0

  for (const item of input) {
    const role = (item as { role?: unknown })?.role
    const content = (item as { content?: unknown })?.content

    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
      return { ok: false, error: 'Each message must have a role of "user" or "assistant" and text content.' }
    }

    if (content.length > MAX_MESSAGE_CHARS) {
      return {
        ok: false,
        error: `That message is too long (${content.length.toLocaleString()} characters, limit ${MAX_MESSAGE_CHARS.toLocaleString()}). Try breaking it into shorter messages.`,
      }
    }

    total += content.length
    messages.push({ role, content })
  }

  if (total > MAX_TOTAL_CHARS) {
    return {
      ok: false,
      error: `This conversation has gotten too long for one request (${total.toLocaleString()} characters, limit ${MAX_TOTAL_CHARS.toLocaleString()}). Try starting a new conversation.`,
    }
  }

  return { ok: true, messages }
}

export async function getChatResponse(
  messages: ChatMessage[],
  founderName?: string,
  buildingDesc?: string,
  profileContext?: string,
  referenceContext?: string,
): Promise<string> {
  const guardResponse = detectOutOfScope(messages)
  if (guardResponse) return guardResponse

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
  return finalizeChatResponse(raw)
}
