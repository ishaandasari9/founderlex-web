'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, ExternalLink } from 'lucide-react'
import { buildNameSearch, NAME_SEARCH_DISCLAIMER } from '@/lib/nameSearch'
import type { FounderProfile } from '@/lib/founderProfile'

const RED   = '#DB1A1A'
const INK   = '#2A2420'
const MUTED = '#6F655B'

type PanelPhase = 'entering' | 'visible' | 'exiting'

export default function NameSearchPanel({
  profile, onClose,
}: {
  profile: FounderProfile | null
  onClose: () => void
}) {
  const [phase, setPhase] = useState<PanelPhase>('entering')
  const [name, setName] = useState(profile?.company_name || '')
  const [submitted, setSubmitted] = useState(name.trim().length > 0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('visible'))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = () => {
    setPhase('exiting')
    window.setTimeout(onClose, 200)
  }

  const result = useMemo(() => {
    if (!submitted || !name.trim()) return null
    return buildNameSearch(name, { state: profile?.state, businessType: profile?.business_type })
  }, [submitted, name, profile])

  return (
    <div className={`confirm-panel-backdrop confirm-panel-backdrop--${phase}`} onClick={handleClose}>
      <div
        className={`confirm-panel-modal confirm-panel-modal--${phase}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-search-panel-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="confirm-panel-header">
          <span className="confirm-panel-eyebrow">Research a name</span>
          <h2 id="name-search-panel-title" className="confirm-panel-title">Similar Name Search</h2>
          <p className="confirm-panel-subtitle">
            Check public databases for names similar to one you&apos;re considering.
          </p>
        </header>

        <div className="confirm-panel-scroll">
          <form
            onSubmit={e => { e.preventDefault(); setSubmitted(name.trim().length > 0) }}
            style={{ display: 'flex', gap: 8, marginBottom: 16 }}
          >
            <input
              className="confirm-panel-input"
              value={name}
              onChange={e => { setName(e.target.value); setSubmitted(false) }}
              placeholder="The name you're considering"
              aria-label="Business, nonprofit, or brand name to search"
              autoFocus
            />
            <button
              type="submit"
              className="confirm-panel-btn confirm-panel-btn--primary"
              disabled={!name.trim()}
              style={{ flexShrink: 0 }}
            >
              Search
            </button>
          </form>

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="confirm-panel-label">Places to check</span>
                {result.links.map(link => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 4,
                      padding: '11px 13px', borderRadius: 10,
                      border: '1px solid rgba(42,36,32,0.14)', background: '#FFFFFF',
                      textDecoration: 'none',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-bricolage), sans-serif', fontWeight: 600, fontSize: 13.5, color: RED }}>
                      {link.label} <ExternalLink size={12} strokeWidth={2} aria-hidden />
                    </span>
                    <span style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 13.5, lineHeight: 1.5, color: INK }}>
                      {link.note}
                    </span>
                  </a>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="confirm-panel-label">What to look for</span>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.guidance.map((g, i) => (
                    <li key={i} style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 14, lineHeight: 1.5, color: INK }}>{g}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="confirm-panel-label">Ask a trademark lawyer</span>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.lawyerQuestions.map((q, i) => (
                    <li key={i} style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 14, lineHeight: 1.5, color: INK }}>{q}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="confirm-panel-disclaimer">
          <ShieldCheck size={14} color={MUTED} strokeWidth={1.6} aria-hidden />
          <span>{NAME_SEARCH_DISCLAIMER}</span>
        </div>

        <div className="confirm-panel-actions">
          <button type="button" className="confirm-panel-btn confirm-panel-btn--secondary" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
