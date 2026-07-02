'use client'

import React, { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import ReadAloudButton from '@/components/ReadAloudButton'

const MUTED = '#6F655B'
const INK   = '#2A2420'

type PanelPhase = 'entering' | 'visible' | 'exiting'

export default function ExplainFormPanel({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<PanelPhase>('entering')
  const [text, setText] = useState('')
  const [explanation, setExplanation] = useState<string | null>(null)
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
    if (!text.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setExplanation(null)
      } else {
        setExplanation(data.explanation)
      }
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
        aria-labelledby="explain-form-panel-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="confirm-panel-header">
          <span className="confirm-panel-eyebrow">Explain this form</span>
          <h2 id="explain-form-panel-title" className="confirm-panel-title">Paste a form or contract</h2>
          <p className="confirm-panel-subtitle">
            A legal form, clause, contract, policy, IRS notice, university IP policy, NDA, or contractor agreement,
            explained in plain English.
          </p>
        </header>

        <div className="confirm-panel-scroll">
          <textarea
            className="confirm-panel-input confirm-panel-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste the text here…"
            aria-label="Form or contract text to explain"
            disabled={loading}
          />

          {error && (
            <div className="confirm-panel-notice" role="status" style={{ marginTop: 14 }}>
              <span className="confirm-panel-notice-title">Could not explain this</span>
              <span className="confirm-panel-notice-text">{error}</span>
            </div>
          )}

          {explanation && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ReadAloudButton text={explanation} label="Read explanation aloud" />
              <div style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'var(--font-newsreader), Georgia, serif',
                fontSize: 14.5,
                lineHeight: 1.6,
                color: INK,
                background: '#FFFFFF',
                border: '1px solid rgba(42,36,32,0.12)',
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                {explanation}
              </div>
            </div>
          )}
        </div>

        <div className="confirm-panel-disclaimer">
          <ShieldCheck size={14} color={MUTED} strokeWidth={1.6} aria-hidden />
          <span>
            Educational, not legal advice, and not a law firm. I can explain what a document says, but I can&apos;t
            tell you whether it&apos;s safe to sign. Have a licensed attorney review it before you rely on it.
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
            disabled={!text.trim() || loading}
          >
            {loading ? 'Explaining…' : 'Explain this'}
          </button>
        </div>
      </div>
    </div>
  )
}
