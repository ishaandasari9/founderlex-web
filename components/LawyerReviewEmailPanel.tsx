'use client'

import React, { useEffect, useState } from 'react'
import { ShieldCheck, Copy, Check } from 'lucide-react'
import ReadAloudButton from '@/components/ReadAloudButton'

const MUTED = '#6F655B'

type PanelPhase = 'entering' | 'visible' | 'exiting'

export default function LawyerReviewEmailPanel({
  email, onChange, onClose,
}: {
  email: string
  onChange: (next: string) => void
  onClose: () => void
}) {
  const [phase, setPhase] = useState<PanelPhase>('entering')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('visible'))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = () => {
    setPhase('exiting')
    window.setTimeout(onClose, 200)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard access denied — the founder can still select-all and copy manually.
    }
  }

  return (
    <div className={`confirm-panel-backdrop confirm-panel-backdrop--${phase}`} onClick={handleClose}>
      <div
        className={`confirm-panel-modal confirm-panel-modal--${phase}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lawyer-email-panel-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="confirm-panel-header">
          <span className="confirm-panel-eyebrow">Draft email to a lawyer</span>
          <h2 id="lawyer-email-panel-title" className="confirm-panel-title">Request legal review</h2>
          <p className="confirm-panel-subtitle">
            Edit this however you like, then copy it into an email to your attorney.
          </p>
          <ReadAloudButton text={email} label="Read email aloud" />
        </header>

        <div className="confirm-panel-scroll">
          <textarea
            className="confirm-panel-input confirm-panel-textarea"
            value={email}
            onChange={e => onChange(e.target.value)}
            aria-label="Lawyer review email draft"
            spellCheck
          />
        </div>

        <div className="confirm-panel-disclaimer">
          <ShieldCheck size={14} color={MUTED} strokeWidth={1.6} aria-hidden />
          <span>
            FounderLex is not a law firm and this is not legal advice. This draft is a starting point —
            review it and send it from your own email.
          </span>
        </div>

        <div className="confirm-panel-actions">
          <button type="button" className="confirm-panel-btn confirm-panel-btn--secondary" onClick={handleClose}>
            Close
          </button>
          <button type="button" className="confirm-panel-btn confirm-panel-btn--primary" onClick={handleCopy}>
            {copied ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Check size={14} strokeWidth={2} /> Copied
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Copy size={14} strokeWidth={2} /> Copy to clipboard
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
