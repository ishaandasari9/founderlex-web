'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import type { RedFlag } from '@/lib/redFlags'
import ReadAloudButton from '@/components/ReadAloudButton'

const AMBER_LABEL = '#8A6412'
const AMBER_BODY  = '#6B4E0E'
const FAINT       = '#9B8F82'

export default function RedFlagCard({ flags }: { flags: RedFlag[] }) {
  if (flags.length === 0) return null

  const readAloudText = flags.map(f => `${f.label}. ${f.whyItMatters} Talk to ${f.talkTo}.`).join(' ')

  return (
    <div className="chat-card-hover-reveal" style={{
      maxWidth: 'min(500px, 100%)',
      width: '100%',
      background: 'linear-gradient(135deg, #FDF6E8 0%, #FBF0DC 100%)',
      border: '1px solid rgba(219,164,60,0.35)',
      borderLeft: '3px solid #D4922A',
      borderRadius: 14,
      padding: '18px 20px',
      boxShadow: '0 10px 26px -16px rgba(42,36,32,0.22)',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-mono), monospace', fontSize: 10, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: AMBER_LABEL,
        }}>
          <AlertTriangle size={12} strokeWidth={2} aria-hidden /> Worth a closer look
        </span>
        <ReadAloudButton text={readAloudText} label="Read flags aloud" iconOnly className="chat-card-read-aloud-btn" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {flags.map(flag => (
          <div key={flag.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-bricolage), sans-serif', fontWeight: 600, fontSize: 14, color: AMBER_LABEL }}>
              {flag.label}
            </span>
            <span style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 14, lineHeight: 1.5, color: AMBER_BODY }}>
              {flag.whyItMatters}
            </span>
            <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11, letterSpacing: '0.02em', color: AMBER_BODY }}>
              Talk to: {flag.talkTo}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, paddingTop: 6, borderTop: '1px solid rgba(219,164,60,0.3)' }}>
        <span style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 12.5, lineHeight: 1.4, color: FAINT }}>
          Educational, not legal advice. FounderLex is not a law firm and can&apos;t tell you what to do here, only that it&apos;s worth getting a professional opinion.
        </span>
      </div>
    </div>
  )
}
