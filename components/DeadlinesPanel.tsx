'use client'

import React, { useEffect, useState } from 'react'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import type { FounderProfile } from '@/lib/founderProfile'
import BusinessContextForm, { type BusinessTypeOption } from '@/components/BusinessContextForm'
import ApiDisclaimerBanner from '@/components/ApiDisclaimerBanner'

const RED   = '#DB1A1A'
const INK   = '#2A2420'
const MUTED = '#6F655B'
const FAINT = '#9B8F82'

type PanelPhase = 'entering' | 'visible' | 'exiting'

interface Deadline {
  id: string
  title: string
  typicalWindow: string
  whatItIs: string
  whyItMatters: string
  verifyAt: string
}

const SITUATION_OPTIONS = [
  { id: 'has_equity', label: 'Founders or employees hold equity subject to vesting' },
  { id: 's_corp_election', label: 'Considering S-corp tax treatment' },
  { id: 'delaware', label: 'Incorporated in Delaware' },
  { id: 'accepting_donations', label: 'Soliciting charitable donations' },
  { id: 'hiring', label: 'Has or plans to have employees' },
]

export default function DeadlinesPanel({
  profile,
  onClose,
}: {
  profile: FounderProfile | null
  onClose: () => void
}) {
  const [phase, setPhase] = useState<PanelPhase>('entering')
  const [businessType, setBusinessType] = useState<BusinessTypeOption | ''>(profile?.business_type ?? '')
  const [situations, setSituations] = useState<string[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[] | null>(null)
  const [disclaimer, setDisclaimer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('visible'))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = () => {
    if (loading) return
    setPhase('exiting')
    window.setTimeout(onClose, 200)
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setDeadlines(null)
    setDisclaimer(null)
    try {
      const res = await fetch('/api/deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessType: businessType || undefined,
          situations,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }
      setDeadlines(data.deadlines ?? [])
      setDisclaimer(data.disclaimer ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`confirm-panel-backdrop confirm-panel-backdrop--${phase}`} onClick={handleClose}>
      <div
        className={`confirm-panel-modal confirm-panel-modal--${phase}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deadlines-panel-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="confirm-panel-header">
          <span className="confirm-panel-eyebrow">Deadline reminders</span>
          <h2 id="deadlines-panel-title" className="confirm-panel-title">Typical filing windows</h2>
          <p className="confirm-panel-subtitle">
            Educational overview of common startup deadlines — not your personal due dates. Confirm the current rule and your own dates with a professional.
          </p>
        </header>

        <div className="confirm-panel-scroll">
          <BusinessContextForm
            businessType={businessType}
            onBusinessTypeChange={setBusinessType}
            situations={situations}
            onSituationsChange={setSituations}
            situationOptions={SITUATION_OPTIONS}
            disabled={loading}
          />

          {error && (
            <div className="confirm-panel-notice" role="status" style={{ marginTop: 16 }}>
              <span className="confirm-panel-notice-title">Could not load deadlines</span>
              <span className="confirm-panel-notice-text">{error}</span>
            </div>
          )}

          {disclaimer && deadlines && (
            <>
              <ApiDisclaimerBanner text={disclaimer} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {deadlines.length === 0 ? (
                  <p style={{ margin: 0, fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 14.5, lineHeight: 1.55, color: MUTED }}>
                    No deadlines matched your selections. Try a different business type or situation, or ask in the chat.
                  </p>
                ) : (
                  deadlines.map(d => (
                    <article
                      key={d.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: '1px solid rgba(42,36,32,0.14)',
                        background: '#FFFFFF',
                      }}
                    >
                      <h3 style={{ margin: 0, fontFamily: 'var(--font-bricolage), sans-serif', fontWeight: 600, fontSize: 15, lineHeight: 1.25, color: INK }}>
                        {d.title}
                      </h3>
                      <div>
                        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT }}>
                          Typical window
                        </span>
                        <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 14, lineHeight: 1.55, color: INK }}>
                          {d.typicalWindow}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: FAINT }}>
                          Why it matters
                        </span>
                        <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 14, lineHeight: 1.55, color: INK }}>
                          {d.whyItMatters}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginTop: 2 }}>
                        <ExternalLink size={11} color={RED} strokeWidth={2} style={{ marginTop: 3, flexShrink: 0 }} aria-hidden />
                        <span style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 13, lineHeight: 1.5, color: MUTED }}>
                          <strong style={{ fontWeight: 600, color: INK }}>Verify at:</strong> {d.verifyAt}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="confirm-panel-disclaimer">
          <ShieldCheck size={14} color={MUTED} strokeWidth={1.6} aria-hidden />
          <span>
            {disclaimer ?? 'These are typical, educational timeframes — not your personal deadlines. Confirm the current requirement and your own dates with a licensed attorney or CPA.'}
          </span>
        </div>

        <div className="confirm-panel-actions">
          <button type="button" className="confirm-panel-btn confirm-panel-btn--secondary" onClick={handleClose} disabled={loading}>
            Close
          </button>
          <button
            type="button"
            className="confirm-panel-btn confirm-panel-btn--primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Loading…' : deadlines ? 'Refresh' : 'Show deadlines'}
          </button>
        </div>
      </div>
    </div>
  )
}
