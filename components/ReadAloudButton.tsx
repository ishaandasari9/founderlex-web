'use client'

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Volume2, Square } from 'lucide-react'
import { isSpeechSupported, isSpeaking, speakText, stopSpeaking, subscribeSpeechChange } from '@/lib/speech'

const RED   = '#DB1A1A'
const FAINT = '#9B8F82'

const noopSubscribe = () => () => {}
// window exists once the client renders but not during SSR, so feature
// detection must go through useSyncExternalStore's server-snapshot path
// rather than a useState initializer, or hydration mismatches.
function useIsSupported(check: () => boolean): boolean {
  return useSyncExternalStore(noopSubscribe, check, () => false)
}

export default function ReadAloudButton({
  text, label = 'Read aloud',
}: { text: string; label?: string }) {
  const supported = useIsSupported(isSpeechSupported)
  const idRef = useRef<symbol | null>(null)
  const [speakingNow, setSpeakingNow] = useState(false)

  useEffect(() => {
    if (!supported) return
    const unsubscribe = subscribeSpeechChange(() => setSpeakingNow(isSpeaking(idRef.current)))
    return () => {
      unsubscribe()
      if (isSpeaking(idRef.current)) stopSpeaking()
    }
  }, [supported])

  if (!supported || !text.trim()) return null

  const handleClick = () => {
    if (speakingNow) {
      stopSpeaking()
      idRef.current = null
      setSpeakingNow(false)
    } else {
      idRef.current = speakText(text)
      setSpeakingNow(isSpeaking(idRef.current))
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={speakingNow}
      aria-label={speakingNow ? 'Stop reading aloud' : label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-mono), monospace',
        fontSize: 10,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: speakingNow ? RED : FAINT,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {speakingNow ? <Square size={11} strokeWidth={2} aria-hidden /> : <Volume2 size={12} strokeWidth={1.8} aria-hidden />}
      {speakingNow ? 'Stop' : label}
    </button>
  )
}
