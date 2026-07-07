'use client'

import React from 'react'
import { Sparkles, X } from 'lucide-react'

// Shown once, right after the consent gate — a small, non-blocking offer,
// not a modal. Skipping (either button) or starting the tour both close
// this permanently for the session; nothing here ever reappears once
// dismissed (app/page.tsx only ever sets the flag that shows this once,
// from the one-time consent-accept flow).
export default function TutorialPrompt({
  onStart, onSkip,
}: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="tutorial-prompt" role="dialog" aria-label="Quick tour offer">
      <button type="button" className="tutorial-prompt__close" onClick={onSkip} aria-label="Dismiss">
        <X size={14} strokeWidth={1.8} />
      </button>
      <span className="tutorial-prompt__icon"><Sparkles size={16} strokeWidth={1.8} /></span>
      <div className="tutorial-prompt__text">
        <span className="tutorial-prompt__title">Want a quick tour?</span>
        <span className="tutorial-prompt__body">See where everything lives — takes about 30 seconds.</span>
      </div>
      <div className="tutorial-prompt__actions">
        <button type="button" className="tutorial-prompt__skip" onClick={onSkip}>Skip</button>
        <button type="button" className="tutorial-prompt__start" onClick={onStart}>Show me around</button>
      </div>
    </div>
  )
}
