'use client'

import React from 'react'

const CREAM_KNOB = '#F7F2EB'
const CLOSED = 'perspective(1700px) rotateY(0deg)'
const OPEN = 'perspective(1700px) rotateY(-148deg)'
const TRANSITION = 'transform 760ms cubic-bezier(.62,0,.30,1), box-shadow 760ms ease'

export interface DoorInside2DProps {
  swingOpen: boolean
  onClick: () => void
}

export default function DoorInside2D({ swingOpen, onClick }: DoorInside2DProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Open the door"
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      style={{
        position: 'relative',
        width: 'min(440px, 86vw)',
        height: 'clamp(300px, 46vh, 440px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        touchAction: 'manipulation',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: '80%',
          height: '97%',
          borderRadius: '200px 200px 14px 14px',
          background:
            'radial-gradient(120% 86% at 50% 96%, #FFFDF8 0%, #FBEFD7 42%, #F0DCBC 78%, #E7CFA9 100%)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: -8,
          width: '46%',
          height: 26,
          background: 'radial-gradient(closest-side, rgba(42,36,32,0.26), rgba(42,36,32,0))',
          filter: 'blur(4px)',
        }}
      />
      <div
        className="door-leaf"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 'clamp(180px, 28vh, 254px)',
          height: 'clamp(300px, 46vh, 440px)',
          marginLeft: 'calc(clamp(180px, 28vh, 254px) / -2)',
          marginTop: 'calc(clamp(300px, 46vh, 440px) / -2)',
          transformOrigin: 'left center',
          transform: swingOpen ? OPEN : CLOSED,
          transition: TRANSITION,
          borderRadius: '50% 50% 8px 8px / 27% 27% 5px 5px',
          background: 'linear-gradient(100deg, #E22020 0%, #DB1A1A 48%, #C01616 100%)',
          boxShadow: swingOpen
            ? '36px 0 60px -30px rgba(42,36,32,0.55)'
            : '0 22px 44px -20px rgba(42,36,32,0.5), inset 0 2px 0 rgba(255,255,255,0.15)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '16%',
            right: '16%',
            top: '11%',
            height: '38%',
            borderRadius: '40px 40px 4px 4px',
            border: '1.5px solid rgba(0,0,0,0.14)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '16%',
            right: '16%',
            top: '55%',
            bottom: '9%',
            borderRadius: 4,
            border: '1.5px solid rgba(0,0,0,0.14)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '11%',
            top: '51%',
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: CREAM_KNOB,
            boxShadow: '0 0 0 3px rgba(0,0,0,0.10)',
          }}
        />
      </div>
    </div>
  )
}
