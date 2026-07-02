'use client'

import React from 'react'

const INK = '#2A2420'

export type BusinessTypeOption = 'product' | 'consulting' | 'nonprofit'

export interface SituationOption {
  id: string
  label: string
}

export default function BusinessContextForm({
  businessType,
  onBusinessTypeChange,
  situations,
  onSituationsChange,
  situationOptions,
  disabled,
}: {
  businessType: BusinessTypeOption | ''
  onBusinessTypeChange: (v: BusinessTypeOption | '') => void
  situations: string[]
  onSituationsChange: (next: string[]) => void
  situationOptions: SituationOption[]
  disabled?: boolean
}) {
  const toggleSituation = (id: string) => {
    if (situations.includes(id)) {
      onSituationsChange(situations.filter(s => s !== id))
    } else {
      onSituationsChange([...situations, id])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="confirm-panel-field-group">
        <span className="confirm-panel-label">Business type</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {([
            { id: 'product', label: 'Product / startup' },
            { id: 'consulting', label: 'Consulting' },
            { id: 'nonprofit', label: 'Nonprofit' },
          ] as const).map(opt => {
            const selected = businessType === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => onBusinessTypeChange(selected ? '' : opt.id)}
                style={{
                  fontFamily: 'var(--font-bricolage), sans-serif',
                  fontWeight: 500,
                  fontSize: 13,
                  color: selected ? '#F7F2EB' : INK,
                  background: selected ? '#DB1A1A' : '#FFFFFF',
                  border: `1px solid ${selected ? '#DB1A1A' : 'rgba(42,36,32,0.16)'}`,
                  borderRadius: 999,
                  padding: '7px 13px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.65 : 1,
                  transition: 'background .15s ease, border-color .15s ease',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="confirm-panel-field-group">
        <span className="confirm-panel-label">Your situation (optional)</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {situationOptions.map(opt => {
            const checked = situations.includes(opt.id)
            return (
              <label
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: `1px solid ${checked ? 'rgba(219,26,26,0.35)' : 'rgba(42,36,32,0.14)'}`,
                  background: checked ? 'rgba(219,26,26,0.06)' : '#FFFFFF',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.65 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleSituation(opt.id)}
                  style={{ marginTop: 3, accentColor: '#DB1A1A', flexShrink: 0 }}
                />
                <span style={{ fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 14, lineHeight: 1.5, color: INK }}>
                  {opt.label}
                </span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
