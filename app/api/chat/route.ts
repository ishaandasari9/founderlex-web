import { NextResponse } from 'next/server'
import { getChatResponse } from '@/lib/chat'
import { extractProfile } from '@/lib/extractProfile'
import { validateProfile, describeProfile, type FounderProfile } from '@/lib/founderProfile'

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

    const text = await getChatResponse(messages, founderName, buildingDesc, profileContext)
    return NextResponse.json({ content: text, profile: updatedProfile })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[chat]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
