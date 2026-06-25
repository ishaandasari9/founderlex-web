'use client'

import React, { useEffect, useRef } from 'react'
import { FileText } from 'lucide-react'

export interface DocumentMarqueeItem {
  key: string
  label: string
  category: string
  color: string
}

interface DocumentMarqueeProps {
  items: DocumentMarqueeItem[]
}

export default function DocumentMarquee({ items }: DocumentMarqueeProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const loop = [...items, ...items]

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      track.style.animationPlayState = 'paused'
      return
    }

    const pause = () => { track.style.animationPlayState = 'paused' }
    const resume = () => { track.style.animationPlayState = 'running' }

    track.addEventListener('mouseenter', pause)
    track.addEventListener('mouseleave', resume)
    track.addEventListener('touchstart', pause, { passive: true })
    track.addEventListener('touchend', resume)

    return () => {
      track.removeEventListener('mouseenter', pause)
      track.removeEventListener('mouseleave', resume)
      track.removeEventListener('touchstart', pause)
      track.removeEventListener('touchend', resume)
    }
  }, [])

  return (
    <div className="doc-marquee" aria-label="Documents FounderLex can draft for you">
      <div className="doc-marquee-fade doc-marquee-fade--left" aria-hidden />
      <div className="doc-marquee-fade doc-marquee-fade--right" aria-hidden />
      <div className="doc-marquee-track" ref={trackRef}>
        {loop.map((doc, i) => (
          <article key={`${doc.key}-${i}`} className="doc-marquee-card">
            <span className="doc-marquee-card__icon" style={{ background: `${doc.color}18` }}>
              <FileText size={16} color={doc.color} strokeWidth={1.6} aria-hidden />
            </span>
            <div className="doc-marquee-card__text">
              <span className="doc-marquee-card__category">{doc.category}</span>
              <span className="doc-marquee-card__label">{doc.label}</span>
            </div>
            <span className="doc-marquee-card__badge">PDF + Word</span>
          </article>
        ))}
      </div>
    </div>
  )
}
