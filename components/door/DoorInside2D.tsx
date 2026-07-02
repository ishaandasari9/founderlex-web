'use client'

import React, { useEffect, useState } from 'react'

const RED = '#DB1A1A'
const CREAM = '#F7F2EB'
const INK = '#2A2420'
const FLOOR = '#EDE4D6'
const WARM_GLOW = '#FBEFD7'
const CREAM_KNOB = '#F7F2EB'

const CLOSED = 'perspective(1700px) rotateY(0deg)'
const OPEN = 'perspective(1700px) rotateY(-148deg)'
const TRANSITION = 'transform 760ms cubic-bezier(.62,0,.30,1), box-shadow 760ms ease'

const DOOR_W = 'clamp(168px, 26vh, 230px)'
const DOOR_H = 'clamp(268px, 42vh, 400px)'
const JAMB_W = 14
const LINTEL_H = 12

export interface DoorInside2DProps {
  swingOpen: boolean
  onClick: () => void
}

export default function DoorInside2D({ swingOpen, onClick }: DoorInside2DProps) {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const handler = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
        borderRadius: 24,
        overflow: 'hidden',
        background: CREAM,
        cursor: 'pointer',
        touchAction: 'manipulation',
      }}
    >
      {/* Warm room wash — matches 3D back-wall glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 92% 72% at 50% 58%, ${WARM_GLOW} 0%, ${CREAM} 52%, #F0E6D8 100%)`,
        }}
      />

      {/* Distant warm plane behind the doorway */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '46%',
          transform: 'translate(-50%, -50%)',
          width: '78%',
          height: '62%',
          borderRadius: '50% 50% 12px 12px',
          background: 'linear-gradient(180deg, #FFFDF8 0%, #FBEFD7 55%, #F0DCBC 100%)',
          opacity: 0.72,
        }}
      />

      {/* Floor slab — matches 3D threshold platform */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '10%',
          transform: 'translateX(-50%)',
          width: '90%',
          height: '20%',
          borderRadius: 16,
          background: `linear-gradient(180deg, #F2E8DA 0%, ${FLOOR} 38%, #E5D9C8 100%)`,
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.45), 0 10px 28px -14px rgba(42,36,32,0.22)',
        }}
      />

      {/* Soft shadow under the floor slab */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: '8%',
          transform: 'translateX(-50%)',
          width: '62%',
          height: 22,
          background: 'radial-gradient(closest-side, rgba(42,36,32,0.24), rgba(42,36,32,0))',
          filter: 'blur(5px)',
        }}
      />

      {/* Doorway assembly: ink frame + warm inner glow + red door */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -54%)',
          width: `calc(${DOOR_W} + ${JAMB_W * 2}px)`,
          height: `calc(${DOOR_H} + ${LINTEL_H}px)`,
        }}
      >
        {/* Inner glow visible through the opening */}
        <div
          style={{
            position: 'absolute',
            left: JAMB_W - 4,
            right: JAMB_W - 4,
            top: LINTEL_H - 2,
            bottom: -6,
            borderRadius: '42% 42% 6px 6px / 22% 22% 4px 4px',
            background: 'linear-gradient(180deg, #FFFDF8 0%, #FBEFD7 100%)',
            opacity: 0.7,
          }}
        />

        {/* Left jamb */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: JAMB_W,
            height: '100%',
            borderRadius: '3px 0 0 3px',
            background: `linear-gradient(90deg, #1E1916 0%, ${INK} 55%, #342E29 100%)`,
            boxShadow: '2px 0 8px -4px rgba(42,36,32,0.35)',
          }}
        />

        {/* Right jamb */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: JAMB_W,
            height: '100%',
            borderRadius: '0 3px 3px 0',
            background: `linear-gradient(270deg, #1E1916 0%, ${INK} 55%, #342E29 100%)`,
            boxShadow: '-2px 0 8px -4px rgba(42,36,32,0.35)',
          }}
        />

        {/* Top lintel */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: LINTEL_H,
            borderRadius: '3px 3px 0 0',
            background: `linear-gradient(180deg, #342E29 0%, ${INK} 100%)`,
            boxShadow: '0 2px 6px -3px rgba(42,36,32,0.35)',
          }}
        />

        {/* Red door leaf */}
        <div
          className="door-leaf"
          style={{
            position: 'absolute',
            left: JAMB_W,
            top: LINTEL_H,
            width: DOOR_W,
            height: DOOR_H,
            transformOrigin: 'left center',
            transform: swingOpen ? OPEN : CLOSED,
            transition: reduceMotion ? 'none' : TRANSITION,
            borderRadius: '50% 50% 8px 8px / 27% 27% 5px 5px',
            background: 'linear-gradient(100deg, #E22020 0%, #DB1A1A 48%, #C01616 100%)',
            boxShadow: swingOpen
              ? '36px 0 60px -30px rgba(42,36,32,0.55)'
              : '0 22px 44px -20px rgba(42,36,32,0.5), inset 0 2px 0 rgba(255,255,255,0.15)',
            zIndex: 2,
          }}
        >
          {/* Arch panel */}
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
          {/* Lower panel */}
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
          {/* Knob */}
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
    </div>
  )
}
