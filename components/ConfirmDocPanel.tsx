'use client'

import React, { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { ConfirmField } from '@/lib/confirmationFields'

const MUTED = '#6F655B'

const TEMPLATE_LABELS: Record<string, string> = {
  founders_agreement: "Founders' Agreement",
  contractor_agreement: 'Contractor Agreement',
  mutual_nda: 'Mutual NDA',
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  consulting_agreement: 'Consulting Agreement',
  sow_template: 'Statement of Work',
  independent_contractor_consulting: 'Independent Contractor Agreement',
  nonprofit_articles: 'Articles of Incorporation',
  nonprofit_bylaws: 'Nonprofit Bylaws',
  nonprofit_conflict_of_interest: 'Conflict of Interest Policy',
}

export interface ConfirmPanelState {
  template: string
  fields: ConfirmField[]
  companyName: string
  state: string
  structure: string
  description: string
  founders: { name: string; equity_pct: number }[]
}

type PanelPhase = 'entering' | 'visible' | 'exiting'

export default function ConfirmDocPanel({
  panel, validation, generating, onChange, onCancel, onConfirm,
}: {
  panel: ConfirmPanelState
  validation: { valid: boolean; errors: string[] }
  generating: boolean
  onChange: (next: ConfirmPanelState) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const [phase, setPhase] = useState<PanelPhase>('entering')
  const label = TEMPLATE_LABELS[panel.template] ?? panel.template

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
        aria-labelledby="confirm-panel-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="confirm-panel-header">
          <span className="confirm-panel-eyebrow">Confirm before generating</span>
          <h2 id="confirm-panel-title" className="confirm-panel-title">{label}</h2>
          <p className="confirm-panel-subtitle">
            Review the details below. You can edit anything before we draft your starter document.
          </p>
        </header>

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
                            <label className="confirm-panel-sublabel" htmlFor={`founder-name-${i}`}>Name</label>
                            <input
                              id={`founder-name-${i}`}
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
                            <label className="confirm-panel-sublabel" htmlFor={`founder-equity-${i}`}>Equity %</label>
                            <input
                              id={`founder-equity-${i}`}
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
            const inputId = `confirm-field-${field.key}`
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

        {!validation.valid && (
          <div className="confirm-panel-notice" role="status">
            <span className="confirm-panel-notice-title">Double-check before generating</span>
            {validation.errors.map((err, i) => (
              <span key={i} className="confirm-panel-notice-text">{err}</span>
            ))}
          </div>
        )}

        <div className="confirm-panel-disclaimer">
          <ShieldCheck size={14} color={MUTED} strokeWidth={1.6} aria-hidden />
          <span>
            Educational, not legal advice. Have a licensed attorney review before signing or filing.
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
            {generating ? 'Generating…' : 'Looks right — generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
