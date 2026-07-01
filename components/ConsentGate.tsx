'use client'

import React, { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

const MUTED = '#6F655B'

type GatePhase = 'entering' | 'visible' | 'exiting'

export default function ConsentGate({
  onAgree, onDisagree,
}: {
  onAgree: () => void
  onDisagree: () => void
}) {
  const [phase, setPhase] = useState<GatePhase>('entering')

  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('visible'))
    return () => cancelAnimationFrame(id)
  }, [])

  const dismiss = (next: () => void) => {
    setPhase('exiting')
    window.setTimeout(next, 200)
  }

  return (
    <div
      className={`confirm-panel-backdrop confirm-panel-backdrop--${phase}`}
      onClick={() => dismiss(onDisagree)}
    >
      <div
        className={`confirm-panel-modal confirm-panel-modal--${phase}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-gate-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="confirm-panel-header">
          <span className="confirm-panel-eyebrow">Before you continue</span>
          <h2 id="consent-gate-title" className="confirm-panel-title">A quick note before we start</h2>
          <p className="confirm-panel-subtitle">
            FounderLex is an educational tool, not legal advice, and not a law firm. Every document it
            generates is a starting point that a licensed attorney must review before you sign or file it.
            Do you understand and agree?
          </p>
        </header>

        <div className="confirm-panel-disclaimer">
          <ShieldCheck size={14} color={MUTED} strokeWidth={1.6} aria-hidden />
          <span>Nothing about this choice is stored, logged, or saved. It only applies to this session.</span>
        </div>

        <div className="confirm-panel-actions">
          <button
            type="button"
            className="confirm-panel-btn confirm-panel-btn--secondary"
            onClick={() => dismiss(onDisagree)}
          >
            I don&apos;t agree
          </button>
          <button
            type="button"
            className="confirm-panel-btn confirm-panel-btn--primary"
            onClick={() => dismiss(onAgree)}
          >
            I agree
          </button>
        </div>
      </div>
    </div>
  )
}
