import { NextResponse } from 'next/server'
import { getChatResponse } from '@/lib/chat'

export async function POST(req: Request) {
  try {
    const { messages, founderName, buildingDesc } = await req.json()
    const text = await getChatResponse(messages, founderName, buildingDesc)
    return NextResponse.json({ content: text })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[chat]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
