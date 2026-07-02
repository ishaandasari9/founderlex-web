'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, ExternalLink } from 'lucide-react'
import { buildNameSearch, NAME_SEARCH_DISCLAIMER } from '@/lib/nameSearch'
import type { FounderProfile } from '@/lib/founderProfile'
import ReadAloudButton from '@/components/ReadAloudButton'

const RED   = '#DB1A1A'
const INK   = '#2A2420'
const MUTED = '#6F655B'
const FAINT = '#9B8F82'

type PanelPhase = 'entering' | 'visible' | 'exiting'

interface WebSource {
  url: string
  title: string
}

export default function NameSearchPanel({
  profile, onClose,
}: {
  profile: FounderProfile | null
  onClose: () => void
}) {
  const [phase, setPhase] = useState<PanelPhase>('entering')
  const [name, setName] = useState(profile?.company_name || '')
  const [submitted, setSubmitted] = useState(name.trim().length > 0)

  const [webLoading, setWebLoading] = useState(false)
  const [webSummary, setWebSummary] = useState<string | null>(null)
  const [webSources, setWebSources] = useState<WebSource[]>([])
  const [webError, setWebError] = useState<string | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('visible'))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = () => {
    setPhase('exiting')
    window.setTimeout(onClose, 200)
  }

  const runWebSearch = async (query: string) => {
    setWebLoading(true)
    setWebError(null)
    setWebSummary(null)
    setWebSources([])
    try {
      const res = await fetch('/api/name-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query }),
      })
      const data = await res.json()
      if (data.error) {
        setWebError(data.error)
      } else {
        setWebSummary(data.summary)
        setWebSources(data.sources ?? [])
      }
    } catch (e: unknown) {
      setWebError(e instanceof Error ? e.message : String(e))
    } finally {
      setWebLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    setSubmitted(trimmed.length > 0)
    if (trimmed) runWebSearch(trimmed)
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
            Live web search for names similar to one you&apos;re considering, plus official databases to check yourself.
          </p>
        </header>

        <div className="confirm-panel-scroll">
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              className="confirm-panel-input"
              value={name}
              onChange={e => { setName(e.target.value); setSubmitted(false) }}
              placeholder="The name you're considering"
              aria-label="Business, nonprofit, or brand name to search"
              autoFocus
              disabled={webLoading}
            />
            <button
              type="submit"
              className="confirm-panel-btn confirm-panel-btn--primary"
              disabled={!name.trim() || webLoading}
              style={{ flexShrink: 0 }}
            >
              {webLoading ? 'Searching…' : 'Search'}
            </button>
          </form>

          {webError && (
            <div className="confirm-panel-notice" role="status" style={{ marginBottom: 16 }}>
              <span className="confirm-panel-notice-title">Could not complete the web search</span>
              <span className="confirm-panel-notice-text">{webError}</span>
            </div>
          )}

          {webSummary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <span className="confirm-panel-label">Live web search results</span>
              <ReadAloudButton text={webSummary} label="Read results aloud" />
              <div style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-newsreader), Georgia, serif',
                fontSize: 14,
                lineHeight: 1.6,
                color: INK,
                background: '#FFFFFF',
                border: '1px solid rgba(42,36,32,0.12)',
                borderRadius: 10,
                padding: '12px 14px',
              }}>
                {webSummary}
              </div>

              {webSources.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT }}>
                    Sources
                  </span>
                  {webSources.map(source => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 13, color: RED, textDecoration: 'none' }}
                    >
                      <ExternalLink size={11} strokeWidth={2} aria-hidden />
                      {source.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="confirm-panel-label">Official databases to check yourself</span>
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
