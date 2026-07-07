'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'

export interface TutorialStep {
  // CSS selector for the element to highlight, e.g. '[data-tutorial="chat-input"]'.
  target: string
  title: string
  body: string
}

interface HighlightRect {
  top: number
  left: number
  width: number
  height: number
}

const RING_PADDING = 6

// Lightweight custom coach-mark: a highlight ring moves to whichever
// element the current step targets, while the instruction card stays fixed
// in one spot (bottom-center) rather than repositioning itself next to
// each target — avoids fragile per-target viewport-overflow math for a
// 5-step tour. No dark full-page backdrop: only the ring and the card are
// rendered, both scoped to their own small area, so there is never a
// full-screen element that could intercept a click — the rest of the app
// stays fully interactive while this is showing.
export default function TutorialTour({
  steps, currentStep, onNext, onBack, onSkip,
}: {
  steps: TutorialStep[]
  currentStep: number
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const [rect, setRect] = useState<HighlightRect | null>(null)
  // The card always sits at a fixed corner (bottom-center by default) rather
  // than following the target, but that means a bottom-fixed target (the
  // chat input) would sit directly under it and the card would intercept
  // clicks meant for the exact control the step is explaining. Flipping the
  // card to the top when the highlighted element is in the lower half of the
  // viewport keeps the two apart without needing full per-target placement math.
  const [cardAtTop, setCardAtTop] = useState(false)
  const step = steps[currentStep]

  const measure = useCallback(() => {
    if (!step) { setRect(null); return }
    const el = document.querySelector(step.target)
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({
      top: r.top - RING_PADDING,
      left: r.left - RING_PADDING,
      width: r.width + RING_PADDING * 2,
      height: r.height + RING_PADDING * 2,
    })
    setCardAtTop(r.top + r.height / 2 > window.innerHeight / 2)
  }, [step])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure])

  // Escape is a second, always-available way out — the tour must never
  // trap the user even if they don't spot the Skip button.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkip() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSkip])

  if (!step) return null
  const isLast = currentStep === steps.length - 1

  return (
    <>
      {rect && (
        <div
          aria-hidden
          className="tutorial-ring"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      <div
        className={`tutorial-card${cardAtTop ? ' tutorial-card--top' : ''}`}
        role="dialog"
        aria-label="Quick tour"
        aria-live="polite"
      >
        <div className="tutorial-card__head">
          <span className="tutorial-card__step">{currentStep + 1} of {steps.length}</span>
          <button type="button" className="tutorial-card__close" onClick={onSkip} aria-label="Skip tour">
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>
        <h3 className="tutorial-card__title">{step.title}</h3>
        <p className="tutorial-card__body">{step.body}</p>
        <div className="tutorial-card__actions">
          <button type="button" className="tutorial-card__skip" onClick={onSkip}>Skip tour</button>
          <div className="tutorial-card__nav">
            {currentStep > 0 && (
              <button type="button" className="tutorial-card__btn tutorial-card__btn--secondary" onClick={onBack}>
                Back
              </button>
            )}
            <button type="button" className="tutorial-card__btn tutorial-card__btn--primary" onClick={onNext}>
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
