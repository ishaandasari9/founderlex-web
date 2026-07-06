import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'
import { detectOutOfScope, GUARD_CATEGORIES } from './outOfScopeGuard'
import { containsForbiddenAssertion } from './forbiddenAssertions'
import { runVerifiedAnswer, verifyAnswer, isSmallTalkDraft, logVerifierEvent } from './runtimeVerifier'
import { isMetaProductQuestion } from './metaQuestion'

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
// below (layer 4). Deliberately doesn't itself contain any risky
// "safe/fine/sign" phrasing that could re-trigger the same check. Exported
// (along with VERIFIER_SAFE_FALLBACK and GUARD_CATEGORIES' responses, via
// isCannedSafeResponse below) so callers like app/api/chat/route.ts can
// tell a genuine, verified answer apart from a canned safe response — A3's
// citation feature must never attach a source link to a fallback that
// didn't actually cite anything.
export const CHAT_SAFE_FALLBACK =
  "I don't want to overstate that last answer, so let me back up: please don't treat what I just said as a guarantee, and check the specifics with a licensed attorney before relying on it."

// Shown when the A2 runtime verifier (layer 3) flags a draft and the single
// regeneration attempt still doesn't come back clean, or the verifier call
// itself fails closed (timeout/error/malformed response). Distinct wording
// from CHAT_SAFE_FALLBACK above so the two layers stay distinguishable if
// ever inspected in logs, though both are equally safe, hedged, and never
// show the flagged draft.
export const VERIFIER_SAFE_FALLBACK =
  "I'm not fully confident in how I answered that, so I don't want to guess. Here's what I can say for certain: this is a real legal question worth getting right, so please check it with a licensed attorney rather than relying on my last answer."

// True for any of the fixed, canned strings getChatResponse can return
// instead of a genuine model-drafted answer: the five deterministic
// out-of-scope guard responses (lib/outOfScopeGuard.ts) and the two safety
// fallbacks above. None of these ever cite a specific reference passage —
// a guard refusal never consulted one, and a fallback exists precisely
// because the draft that WOULD have cited one got rejected — so this is
// the single source of truth callers use to decide whether showing a
// citation makes any sense at all (A3: "an unsupported claim shows no
// source" applies just as much to a fallback as to a bad draft).
export function isCannedSafeResponse(text: string): boolean {
  if (text === CHAT_SAFE_FALLBACK || text === VERIFIER_SAFE_FALLBACK) return true
  return GUARD_CATEGORIES.some((category) => category.response === text)
}

// Markdown/dash formatting only, no safety check — split out so the A2
// runtime verifier (which needs the same display-ready text a reader would
// see) and finalizeChatResponse (layer 4, below) share one implementation.
// Idempotent: safe to call again on already-formatted text.
//
// Codex re-review (High, EC-08): the dash-to-comma replacement below is
// meant for a sentence-level em/en dash pause ("text — more text" ->
// "text, more text"), but a model writing a numeric range with the
// typographically-correct en dash ("$45–65") got the SAME blind treatment,
// corrupting it into "$45, 65" — reproducible every time the model phrases
// a range that way, not model variance. A digit-dash-digit span is
// converted to a plain hyphen FIRST, before the general replacement runs,
// so "$45–65" becomes "$45-65" instead.
function formatChatText(raw: string): string {
  return raw
    .replace(/(\d)\s*[—–]\s*(\$?\d)/g, '$1-$2')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
}

// Code-level backstop, independent of the system prompt: runs after every
// substantive chat reply, before it's ever returned to a caller — the LAST
// layer, after the A2 runtime verifier (layer 3) has already had its say.
// Reuses the shared containsForbiddenAssertion scan (also used by
// lib/explainForm.ts and lib/redFlags.ts) rather than forking a second copy
// of the pattern list, per Codex audit finding — a jailbreak or an unusual
// model phrasing (e.g. "the wall usually holds up fine" for LLC liability)
// that implies a guaranteed legal outcome must never reach the user, even
// if the system prompt's instructions get talked around, and even if the
// verifier itself somehow missed it (defense in depth: the two layers are
// independent, neither assumes the other caught everything).
//
// The check runs on the fully formatted, display-ready text (markdown/dash
// stripping already applied), matching lib/explainForm.ts's
// finalizeExplanation convention: the check and what a reader actually sees
// must be exactly the same string.
export function finalizeChatResponse(raw: string): string {
  const formatted = formatChatText(raw)
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

function buildSystemPrompt(
  founderName?: string,
  buildingDesc?: string,
  profileContext?: string,
  referenceContext?: string,
): string {
  const contextParts = [
    founderName ? `The founder's name is ${founderName} — use their name naturally once or twice.` : '',
    buildingDesc ? `They described what they're building as: "${buildingDesc}".` : '',
    profileContext || '',
    referenceContext || '',
  ].filter(Boolean)

  const base = getSystemPrompt()
  const contextLine = contextParts.length ? `\n\n[Session context: ${contextParts.join(' ')}]` : ''
  return base + contextLine + FORMAT_RULES
}

// A regeneration attempt (A2, layer 3) re-sends the full conversation with
// the verifier's specific issues appended to the system prompt, so the
// model gets exactly one chance to fix exactly what was flagged rather than
// guessing at a fresh answer from scratch.
function buildRegenerationNote(issues: string[]): string {
  return `\n\n[Your previous draft answer to this question had specific problems that must be fixed in this attempt: ${issues.join('; ')}. Address every one of them directly. If you cannot answer accurately and safely within those constraints, say so plainly and refer the founder to a licensed attorney instead of guessing.]`
}

async function callModel(messages: ChatMessage[], system: string): Promise<string> {
  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    system,
    messages,
  })
  const block = response.content[0]
  return block.type === 'text' ? block.text : ''
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

  const system = buildSystemPrompt(founderName, buildingDesc, profileContext, referenceContext)
  const rawDraft = await callModel(messages, system)
  const draft = formatChatText(rawDraft)

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''

  // A2, layer 3: only run the second-model verifier on substantive legal
  // answers, not small talk, to control cost (README-v3 A2 backend note).
  // Gated on the DRAFT, not the user's message (Codex audit, High): a short
  // user reply like "yes" mid-conversation is not itself evidence the
  // resulting answer is small talk — the answer is what gets verified, so
  // the answer is what gets classified. Small talk skips straight to layer
  // 4 below — there's no legal claim in "You're welcome!" for a verifier
  // to check.
  //
  // A clear product/meta question about FounderLex itself ("what can you
  // do?", "are you free?", "what documents do you make?") skips the verifier
  // for the same reason: its answer is a product fact, not a legal-safety
  // claim, so there is nothing for the verifier to check — yet routing it
  // through anyway meant a verifier timeout or malformed verdict (both fail
  // closed) could swap a good product answer for the safety fallback, i.e.
  // the tool "refusing" to say what it does. The out-of-scope guard above
  // still ran first; the layer-4 backstop below still runs after.
  if (isSmallTalkDraft(draft) || isMetaProductQuestion(lastUserMessage)) {
    return finalizeChatResponse(draft)
  }

  const result = await runVerifiedAnswer({
    initialDraft: draft,
    verify: (text) => verifyAnswer(lastUserMessage, text, referenceContext ?? ''),
    regenerate: async (issues) => {
      const retrySystem = system + buildRegenerationNote(issues)
      const rawRetry = await callModel(messages, retrySystem)
      return formatChatText(rawRetry)
    },
    fallbackText: VERIFIER_SAFE_FALLBACK,
  })

  logVerifierEvent({ flagged: result.flagged, usedFallback: result.usedFallback })

  // Layer 4 still runs last, on whichever text layer 3 settled on
  // (untouched clean draft, regenerated clean draft, or the verifier's own
  // safe fallback) — the two layers are independent and neither assumes
  // the other already caught everything.
  return finalizeChatResponse(result.text)
}
