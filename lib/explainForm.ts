import Anthropic from '@anthropic-ai/sdk'
import { getSystemPrompt } from './chat'
import { detectOutOfScope } from './outOfScopeGuard'

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

// Required verbatim — never paraphrase. This is the one line every
// explanation must end with, enforced in code rather than left to the model.
export const EXPLAIN_CLOSING_LINE =
  "I can explain this, but I can't tell you whether signing it is legally safe."

const EXPLAIN_FORMAT_RULES = `
You are now in "Explain This Form" mode. The founder has pasted in a legal form, clause, contract, policy, IRS notice, university IP policy, NDA, or contractor agreement and wants it explained in plain English.

Follow this exact structure. Use these exact section headers, each as plain text on its own line (no markdown, no asterisks, no # symbols):

1. Here's what this form appears to be
2. Plain-English summary
3. Sections that matter most
4. Things to double-check
5. Questions to ask a lawyer

Under "Things to double-check," call out any blanks or fields left to fill in, and anything confusing, inconsistent, or unusually one-sided.

Hard boundary, never break this: you explain and flag, you never advise whether to sign. Never say or imply "you should sign this," "this is safe to sign," "this is legally fine," "this looks good," "you're fine to proceed," or anything else that reads as a green light or a red light on signing. Describe what the document says and what to check. Do not decide for them.

End your reply with exactly this sentence, verbatim, and nothing after it: "${EXPLAIN_CLOSING_LINE}"`

// Defense in depth: even with the prompt above, an LLM reply is never
// guaranteed. If the model's own words slip past the hard boundary, we don't
// try to surgically edit prose — we replace the whole reply with a safe one.
const FORBIDDEN_ASSERTION_PATTERNS: RegExp[] = [
  /you should sign/i,
  /(is|looks|seems|appears)\s+(legally\s+)?(fine|safe|okay|ok)\s+to\s+sign/i,
  /safe\s+(for\s+you\s+)?to\s+sign/i,
  /this\s+is\s+legally\s+(fine|sound|safe|okay|ok)/i,
  /(go ahead|okay|ok|fine|safe)\s+to\s+(sign|proceed)/i,
  /you\s+can\s+(safely\s+)?sign/i,
  /no\s+(need|reason)\s+to\s+(worry|consult|see a lawyer)/i,
]

export function containsForbiddenAssertion(text: string): boolean {
  return FORBIDDEN_ASSERTION_PATTERNS.some((p) => p.test(text))
}

const SAFE_FALLBACK =
  `I wasn't able to put together an explanation that stays within what I'm allowed to do here. Please paste it again, or bring it straight to a licensed attorney. ${EXPLAIN_CLOSING_LINE}`

function stripAttemptedClosingLine(text: string): string {
  const lines = text.trim().split('\n')
  const last = lines[lines.length - 1]?.trim() ?? ''
  const looksLikeClosingAttempt = /^i can explain/i.test(last) && /legally safe/i.test(last)
  return (looksLikeClosingAttempt ? lines.slice(0, -1) : lines).join('\n').trim()
}

// The model doesn't reliably honor "no markdown" over a longer structured
// reply, so strip it in code the same way lib/chat.ts does for short replies.
// Line breaks are preserved (unlike lib/speech.ts's stripper) since this text
// is read on screen, not spoken.
function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
}

// Enforces the mandated closing line in code, since an LLM cannot be trusted
// to reproduce a sentence verbatim on every call.
export function finalizeExplanation(raw: string): string {
  if (containsForbiddenAssertion(raw)) return SAFE_FALLBACK
  const body = stripAttemptedClosingLine(stripMarkdownFormatting(raw))
  return `${body}\n\n${EXPLAIN_CLOSING_LINE}`
}

export async function explainForm(pastedText: string): Promise<string> {
  const trimmed = pastedText.trim()
  if (!trimmed) throw new Error('Paste the text of a form or contract to explain.')

  // Same code-level backstop used for chat: criminal matters, active disputes,
  // securities/fundraising, immigration, and tax strategy never get a
  // substantive answer here either, even framed as "explain this."
  const guardResponse = detectOutOfScope([{ role: 'user', content: trimmed }])
  if (guardResponse) return guardResponse

  const system = `${getSystemPrompt()}\n\n${EXPLAIN_FORMAT_RULES}`

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1400,
    system,
    messages: [{ role: 'user', content: `Explain this:\n\n${trimmed}` }],
  })

  const block = response.content[0]
  const raw = block.type === 'text' ? block.text : ''
  return finalizeExplanation(raw)
}
