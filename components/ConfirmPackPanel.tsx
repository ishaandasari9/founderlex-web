'use client'

import React, { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { ConfirmField } from '@/lib/confirmationFields'
import { TEMPLATE_LABELS } from '@/lib/templateMeta'
import ReadAloudButton from '@/components/ReadAloudButton'

const MUTED = '#6F655B'

// B2 Founder Pack confirm gate — deliberately mirrors
// components/ConfirmDocPanel.tsx's structure and CSS classes exactly (same
// confirm-panel-* classes from globals.css) for visual consistency, but
// shows the UNION of relevant fields across every document in the pack and
// the list of documents that will be generated, instead of a single
// template. README-v3 B2: "Keep the confirm-contents gate — a batch action
// shouldn't skip confirmation" — this is that gate for the batch case, not
// a bypass of it.
export interface ConfirmPackPanelState {
  templateNames: string[]
  fields: ConfirmField[]
  companyName: string
  state: string
  structure: string
  description: string
  founders: { name: string; equity_pct: number }[]
}

type PanelPhase = 'entering' | 'visible' | 'exiting'

export default function ConfirmPackPanel({
  panel, validation, generating, onChange, onCancel, onConfirm,
}: {
  panel: ConfirmPackPanelState
  validation: { valid: boolean; errors: string[] }
  generating: boolean
  onChange: (next: ConfirmPackPanelState) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const [phase, setPhase] = useState<PanelPhase>('entering')

  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('visible'))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleCancel = () => {
    if (generating) return
    setPhase('exiting')
    window.setTimeout(onCancel, 200)
  }

  const scalarSetters: Record<string, (v: string) => void> = {
    company_name: v => onChange({ ...panel, companyName: v }),
    state: v => onChange({ ...panel, state: v }),
    structure: v => onChange({ ...panel, structure: v }),
    description: v => onChange({ ...panel, description: v }),
  }
  const scalarValues: Record<string, string> = {
    company_name: panel.companyName,
    state: panel.state,
    structure: panel.structure,
    description: panel.description,
  }

  return (
    <div
      className={`confirm-panel-backdrop confirm-panel-backdrop--${phase}`}
      onClick={generating ? undefined : handleCancel}
    >
      <div
        className={`confirm-panel-modal confirm-panel-modal--${phase}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-pack-panel-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="confirm-panel-header">
          <span className="confirm-panel-eyebrow">Confirm before generating</span>
          <h2 id="confirm-pack-panel-title" className="confirm-panel-title">
            Your Founder Pack — {panel.templateNames.length} document{panel.templateNames.length === 1 ? '' : 's'}
          </h2>
          <p className="confirm-panel-subtitle">
            Review the details below. You can edit anything before we draft all of your recommended documents at once.
          </p>
        </header>

        <div className="confirm-panel-scroll">
          <div className="confirm-panel-field-group">
            <span className="confirm-panel-label">What&apos;s in this pack</span>
            <ul style={{ margin: 0, paddingLeft: 18, fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 14.5, lineHeight: 1.6 }}>
              {panel.templateNames.map(t => (
                <li key={t}>{TEMPLATE_LABELS[t] ?? t}</li>
              ))}
            </ul>
          </div>

          <div className="confirm-panel-fields">
            {panel.fields.map(field => {
              if (field.type === 'founders') {
                return (
                  <div key="founders" className="confirm-panel-field-group">
                    <span className="confirm-panel-label">Founders</span>
                    {panel.founders.length === 0 ? (
                      <span className="confirm-panel-empty">No founders on file yet.</span>
                    ) : (
                      <div className="confirm-panel-founders">
                        {panel.founders.map((f, i) => (
                          <div key={i} className="confirm-panel-founder-row">
                            <div className="confirm-panel-input-wrap confirm-panel-input-wrap--grow">
                              <label className="confirm-panel-sublabel" htmlFor={`pack-founder-name-${i}`}>Name</label>
                              <input
                                id={`pack-founder-name-${i}`}
                                className="confirm-panel-input"
                                value={f.name}
                                placeholder="Founder name"
                                onChange={e => {
                                  const next = [...panel.founders]
                                  next[i] = { ...next[i], name: e.target.value }
                                  onChange({ ...panel, founders: next })
                                }}
                              />
                            </div>
                            <div className="confirm-panel-input-wrap confirm-panel-input-wrap--narrow">
                              <label className="confirm-panel-sublabel" htmlFor={`pack-founder-equity-${i}`}>Equity %</label>
                              <input
                                id={`pack-founder-equity-${i}`}
                                className="confirm-panel-input"
                                type="number"
                                value={f.equity_pct}
                                placeholder="Equity %"
                                onChange={e => {
                                  const next = [...panel.founders]
                                  next[i] = { ...next[i], equity_pct: parseFloat(e.target.value) || 0 }
                                  onChange({ ...panel, founders: next })
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              const inputId = `confirm-pack-field-${field.key}`
              return (
                <div key={field.key} className="confirm-panel-field-group">
                  <label className="confirm-panel-label" htmlFor={inputId}>{field.label}</label>
                  <input
                    id={inputId}
                    className="confirm-panel-input"
                    value={scalarValues[field.key] ?? ''}
                    placeholder={field.label}
                    onChange={e => scalarSetters[field.key]?.(e.target.value)}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {!validation.valid && (
          <div className="confirm-panel-notice" role="status">
            <span className="confirm-panel-notice-title">Double-check before generating</span>
            {validation.errors.map((err, i) => (
              <span key={i} className="confirm-panel-notice-text">{err}</span>
            ))}
            <ReadAloudButton text={validation.errors.join('. ')} label="Read warning aloud" />
          </div>
        )}

        <div className="confirm-panel-disclaimer">
          <ShieldCheck size={14} color={MUTED} strokeWidth={1.6} aria-hidden />
          <span>
            Educational, not legal advice. Have a licensed attorney review every document before signing or filing.
          </span>
        </div>

        <div className="confirm-panel-actions">
          <button
            type="button"
            className="confirm-panel-btn confirm-panel-btn--secondary"
            onClick={handleCancel}
            disabled={generating}
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-panel-btn confirm-panel-btn--primary"
            onClick={generating ? undefined : onConfirm}
            disabled={generating}
          >
            {generating ? 'Generating…' : 'Looks right, generate my pack'}
          </button>
        </div>
      </div>
    </div>
  )
}
