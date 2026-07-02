'use client'

import React, { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import ReadAloudButton from '@/components/ReadAloudButton'

const INK   = '#2A2420'
const MUTED = '#6F655B'

const COMPARE_DISCLAIMER =
  "I can explain what changed, but I can't tell you whether signing either version is legally safe. Have a licensed attorney review both versions before you rely on or sign either one."

type PanelPhase = 'entering' | 'visible' | 'exiting'

export default function ComparePanel({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<PanelPhase>('entering')
  const [originalText, setOriginalText] = useState('')
  const [revisedText, setRevisedText] = useState('')
  const [comparison, setComparison] = useState<string | null>(null)
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
    if (!originalText.trim() || !revisedText.trim() || loading) return
    setLoading(true)
    setError(null)
    setComparison(null)
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalText, revisedText }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setComparison(data.comparison)
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
        aria-labelledby="compare-panel-title"
        style={{ maxWidth: 560 }}
        onClick={e => e.stopPropagation()}
      >
        <header className="confirm-panel-header">
          <span className="confirm-panel-eyebrow">Document compare</span>
          <h2 id="compare-panel-title" className="confirm-panel-title">Compare two versions</h2>
          <p className="confirm-panel-subtitle">
            Paste an original and a revised version of the same document — an NDA redline, contract edits, or two drafts — and see what changed in plain English.
          </p>
        </header>

        <div className="confirm-panel-scroll">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="confirm-panel-field-group">
              <label className="confirm-panel-label" htmlFor="compare-original">Original version</label>
              <textarea
                id="compare-original"
                className="confirm-panel-input confirm-panel-textarea"
                value={originalText}
                onChange={e => setOriginalText(e.target.value)}
                placeholder="Paste the original version here…"
                disabled={loading}
                style={{ minHeight: 140 }}
              />
            </div>
            <div className="confirm-panel-field-group">
              <label className="confirm-panel-label" htmlFor="compare-revised">Revised version</label>
              <textarea
                id="compare-revised"
                className="confirm-panel-input confirm-panel-textarea"
                value={revisedText}
                onChange={e => setRevisedText(e.target.value)}
                placeholder="Paste the revised version here…"
                disabled={loading}
                style={{ minHeight: 140 }}
              />
            </div>
          </div>

          {error && (
            <div className="confirm-panel-notice" role="status" style={{ marginTop: 16 }}>
              <span className="confirm-panel-notice-title">Could not compare</span>
              <span className="confirm-panel-notice-text">{error}</span>
            </div>
          )}

          {comparison && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ReadAloudButton text={comparison} label="Read comparison aloud" />
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
                {comparison}
              </div>
            </div>
          )}
        </div>

        <div className="confirm-panel-disclaimer">
          <ShieldCheck size={14} color={MUTED} strokeWidth={1.6} aria-hidden />
          <span>{COMPARE_DISCLAIMER}</span>
        </div>

        <div className="confirm-panel-actions">
          <button type="button" className="confirm-panel-btn confirm-panel-btn--secondary" onClick={handleClose} disabled={loading}>
            Close
          </button>
          <button
            type="button"
            className="confirm-panel-btn confirm-panel-btn--primary"
            onClick={handleSubmit}
            disabled={!originalText.trim() || !revisedText.trim() || loading}
          >
            {loading ? 'Comparing…' : 'Compare versions'}
          </button>
        </div>
      </div>
    </div>
  )
}
