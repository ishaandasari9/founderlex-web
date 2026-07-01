import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { getChatResponse } from '@/lib/chat'
import { extractProfile } from '@/lib/extractProfile'
import { validateProfile, describeProfile, type FounderProfile } from '@/lib/founderProfile'
import { selectReferenceFiles } from '@/lib/selectReferences'

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
    const { messages, founderName, buildingDesc, profile } = await req.json() as {
      messages: Parameters<typeof getChatResponse>[0]
      founderName?: string
      buildingDesc?: string
      profile?: FounderProfile | null
    }

    const updatedProfile = await extractProfile(messages, profile ?? null)
    const validation = validateProfile(updatedProfile)
    const profileContext = describeProfile(updatedProfile, validation)

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
