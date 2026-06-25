'use client'

import React from 'react'

const CREAM = '#F7F2EB'
const INK = '#2A2420'
const RED = '#DB1A1A'
const FAINT = '#9B8F82'
const MONO = 'var(--font-mono), monospace'

function DoorGlyph() {
  return (
    <span
      className="door-hero-loader-glyph"
      style={{ position: 'relative', display: 'inline-block', width: 28, height: 32, flexShrink: 0 }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '14px 14px 3px 3px',
          background: INK,
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: 6,
          right: 6,
          bottom: 0,
          top: 11,
          borderRadius: '6px 6px 1px 1px',
          background: RED,
        }}
      />
    </span>
  )
}

export default function DoorHeroLoader() {
  return (
    <div
      className="door-hero-loader"
      role="status"
      aria-live="polite"
      aria-label="Loading the doorway"
      style={{
        position: 'relative',
        width: 'min(440px, 86vw)',
        height: 'clamp(300px, 46vh, 440px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        borderRadius: 24,
        background: `radial-gradient(120% 90% at 50% 100%, #FFFDF8 0%, ${CREAM} 55%, #F0E6D8 100%)`,
        boxShadow: '0 24px 48px -28px rgba(42,36,32,0.35)',
      }}
    >
      <DoorGlyph />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="loading-dot" />
        <span className="loading-dot" />
        <span className="loading-dot" />
      </div>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: FAINT,
        }}
      >
        Opening the doorway
      </span>
    </div>
  )
}
