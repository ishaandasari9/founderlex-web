import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getChatResponse, validateChatInput } from '@/lib/chat'
import { extractProfile } from '@/lib/extractProfile'
import { validateProfile, describeProfile, type FounderProfile } from '@/lib/founderProfile'
import { selectReferenceFiles } from '@/lib/selectReferences'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { requireJsonContentType, readBodyWithLimit } from '@/lib/requestGuard'

const CHAT_RATE_LIMIT = 20
const CHAT_RATE_WINDOW_SECONDS = 60
const MAX_CHAT_BODY_BYTES = 200_000

const referenceCache = new Map<string, string>()

function readReferenceFile(filename: string): string {
  const cached = referenceCache.get(filename)
  if (cached) return cached
  const content = readFileSync(join(process.cwd(), 'skill', 'references', filename), 'utf8')
  referenceCache.set(filename, content)
  return content
}

function buildReferenceContext(files: string[]): string {
  if (files.length === 0) return ''
  const sections = files.map((f) => `[${f}]\n${readReferenceFile(f)}`).join('\n\n')
  return `Reference material for this turn. Base your legal explanation only on this material, don't add specifics (fees, deadlines, statutory citations) beyond what's written here. If it doesn't cover what's being asked, say so plainly and point the founder to a lawyer instead of guessing:\n\n${sections}`
}

export async function POST(req: Request) {
  try {
    const contentTypeError = requireJsonContentType(req)
    if (contentTypeError) {
      return NextResponse.json({ error: contentTypeError }, { status: 415 })
    }

    const ip = getClientIp(req)
    const allowed = await checkRateLimit(`chat:${ip}`, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_SECONDS)
    if (!allowed) {
      return NextResponse.json(
        { error: "You're sending messages a little too quickly. Please wait a moment and try again." },
        { status: 429 },
      )
    }

    const bodyResult = await readBodyWithLimit(req, MAX_CHAT_BODY_BYTES)
    if (bodyResult.error) {
      return NextResponse.json({ error: bodyResult.error }, { status: 413 })
    }

    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(bodyResult.text)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const { messages: rawMessages, founderName, buildingDesc, profile } = parsedBody as {
      messages?: unknown
      founderName?: string
      buildingDesc?: string
      profile?: FounderProfile | null
    }

    const chatInputValidation = validateChatInput(rawMessages)
    if (!chatInputValidation.ok) {
      return NextResponse.json({ error: chatInputValidation.error }, { status: 400 })
    }
    const { messages } = chatInputValidation

    const updatedProfile = await extractProfile(messages, profile ?? null)
    const profileValidation = validateProfile(updatedProfile)
    const profileContext = describeProfile(updatedProfile, profileValidation)

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    const referenceFiles = selectReferenceFiles(updatedProfile.business_type, lastUserMessage)
    const referenceContext = buildReferenceContext(referenceFiles)

    const text = await getChatResponse(messages, founderName, buildingDesc, profileContext, referenceContext)
    return NextResponse.json({ content: text, profile: updatedProfile })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[chat]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
