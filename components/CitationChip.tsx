'use client'

import { ExternalLink } from 'lucide-react'

const FAINT = '#9B8F82'

export interface CitationLink {
  label: string
  url: string
}

// A3 inline source citations. Deliberately styled as a small inline
// footnote (matching ReadAloudButton's mono/uppercase/no-background
// convention) rather than a boxed card — it sits directly beside
// ReadAloudButton in the same per-message action row, and a chat bubble is
// the wrong place for a heavier NameSearchPanel-style link card.
//
// Renders nothing if there are no citations — same "return null" guard
// ReadAloudButton uses — so a message with no citation (out-of-scope
// refusal, a safety fallback, or an answer nothing in
// skill/references/*.md actually supports) shows no footnote at all,
// rather than an empty row.
export default function CitationChip({ citations }: { citations?: CitationLink[] }) {
  if (!citations || citations.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
      {citations.map((c) => (
        <a
          key={c.url}
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 10,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: FAINT,
            textDecoration: 'none',
          }}
        >
          <ExternalLink size={11} strokeWidth={1.8} aria-hidden />
          Source: {c.label}
        </a>
      ))}
    </div>
  )
}
