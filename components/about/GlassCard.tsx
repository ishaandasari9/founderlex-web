'use client'

import React, { useState } from 'react'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

export default function GlassCard({ children, className = '', style, onClick }: GlassCardProps) {
  const [hov, setHov] = useState(false)
  const [pressed, setPressed] = useState(false)

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false) }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className={`glass-card ${className}`.trim()}
      style={{
        transform: pressed ? 'translateY(1px) scale(0.99)' : hov ? 'translateY(-4px)' : 'none',
        ...style,
      }}
    >
      <div className="glass-card__shine" aria-hidden />
      {children}
    </div>
  )
}
