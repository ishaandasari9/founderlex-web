'use client'

import React from 'react'
import { ShieldAlert } from 'lucide-react'

const MUTED = '#6F655B'

export default function ApiDisclaimerBanner({ text }: { text: string }) {
  return (
    <div className="confirm-panel-notice" role="note" style={{ marginBottom: 16 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ShieldAlert size={14} color={MUTED} strokeWidth={1.8} aria-hidden />
        <span className="confirm-panel-notice-title">Important</span>
      </span>
      <span className="confirm-panel-notice-text">{text}</span>
    </div>
  )
}
