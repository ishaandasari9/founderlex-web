'use client'

import React, { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { buildChecklist } from '@/lib/beforeYouSignChecklist'
import ReadAloudButton from '@/components/ReadAloudButton'

const RED   = '#DB1A1A'
const INK   = '#2A2420'
const FAINT = '#9B8F82'
const WHITE = '#FFFFFF'

export default function BeforeYouSignChecklist({
  label, template, filled,
}: { label: string; template: string; filled: string }) {
  const items = buildChecklist(template, filled)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => setChecked(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div style={{
      maxWidth: 460,
      width: '100%',
      background: WHITE,
      border: '1px solid rgba(42,36,32,0.12)',
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FAINT }}>
          Before you sign
        </span>
        <span style={{ fontFamily: 'var(--font-bricolage), sans-serif', fontWeight: 600, fontSize: 15, color: INK }}>
          {label} checklist
        </span>
        <ReadAloudButton text={items.map(item => item.text).join('. ')} label="Read checklist aloud" />
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => {
          const done = !!checked[item.id]
          return (
            <li key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                aria-pressed={done}
                aria-label={done ? 'Mark as not done' : 'Mark as done'}
                style={{
                  flexShrink: 0,
                  width: 16,
                  height: 16,
                  marginTop: 2,
                  borderRadius: 4,
                  border: `1.5px solid ${done ? RED : 'rgba(42,36,32,0.25)'}`,
                  background: done ? RED : 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
              <span style={{
                fontFamily: 'var(--font-newsreader), Georgia, serif',
                fontSize: 14.5,
                lineHeight: 1.5,
                color: done ? FAINT : INK,
                textDecoration: done ? 'line-through' : 'none',
              }}>
                {item.text}
              </span>
            </li>
          )
        })}
      </ul>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, paddingTop: 6, borderTop: '1px solid rgba(42,36,32,0.08)' }}>
        <ShieldCheck size={12} color={FAINT} strokeWidth={1.6} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden />
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, lineHeight: 1.6, color: FAINT }}>
          Educational, not legal advice. FounderLex is not a law firm — have a licensed attorney review before you sign, file, or rely on this.
        </span>
      </div>
    </div>
  )
}
