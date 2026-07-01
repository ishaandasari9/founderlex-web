import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { FounderProfile } from './founderProfile'

// Service-role client — bypasses RLS, must never be imported by client components.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

export interface StoredSession {
  messages: unknown[]
  profile: FounderProfile | null
}

export async function getSession(id: string): Promise<StoredSession | null> {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('messages, profile')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return { messages: (data.messages as unknown[]) ?? [], profile: (data.profile as FounderProfile) ?? null }
}

export async function saveSession(id: string, messages: unknown[], profile: FounderProfile | null): Promise<void> {
  const { error } = await supabaseAdmin
    .from('sessions')
    .upsert({ id, messages, profile, updated_at: new Date().toISOString() })

  if (error) throw error
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('sessions').delete().eq('id', id)
  if (error) throw error
}
