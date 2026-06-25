import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

let cachedPrompt: string | null = null

function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt
  try {
    const path = join(process.cwd(), '..', 'skill', 'SKILL.md')
    cachedPrompt = readFileSync(path, 'utf8')
    return cachedPrompt
  } catch {
    return `You are FounderLex, a friendly legal-basics educator for first-time student founders in the United States.
Explain startup legal basics in plain English. You are NOT a lawyer and do NOT give legal advice.
Every document you help draft is an educational starting point requiring attorney review.
Keep answers concise, warm, and concrete. Use their actual situation in examples.`
  }
}

export async function POST(req: Request) {
  try {
    const { messages, founderName, buildingDesc } = await req.json()

    const contextParts = [
      founderName ? `The founder's name is ${founderName} — use their name naturally once or twice.` : '',
      buildingDesc ? `They described what they're building as: "${buildingDesc}".` : '',
    ].filter(Boolean)

    const FORMAT_RULES = `
REPLY STYLE - follow these exactly, they override everything else:
- Plain conversational text only. No markdown: no **bold**, no *italics*, no # headers, no bullet points, no numbered lists.
- No em dashes (the long dash like this: —). Use a comma or just end the sentence instead.
- Every reply must be one short paragraph: 3 to 5 sentences maximum. Never a wall of text.
- Write like a knowledgeable friend texting. Warm, direct, gets to the point fast.
- If you need to name multiple things, weave them into a sentence naturally, not as a list.`

    const base = getSystemPrompt()
    const contextLine = contextParts.length ? `\n\n[Session context: ${contextParts.join(' ')}]` : ''
    const system = base + contextLine + FORMAT_RULES

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
      system,
      messages,
    })

    const block = response.content[0]
    const raw = block.type === 'text' ? block.text : ''
    // Strip formatting the model sneaks in despite instructions
    const text = raw
      .replace(/\s*—\s*/g, ', ')          // em dash -> comma
      .replace(/\s*–\s*/g, ', ')          // en dash -> comma
      .replace(/\*\*(.+?)\*\*/g, '$1')    // **bold** -> plain
      .replace(/\*(.+?)\*/g, '$1')        // *italic* -> plain
      .replace(/^#+\s+/gm, '')            // # headers -> plain
    return NextResponse.json({ content: text })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[chat]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
