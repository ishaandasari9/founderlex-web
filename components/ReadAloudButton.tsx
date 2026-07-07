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
  text, label = 'Read aloud', iconOnly = false, className,
}: { text: string; label?: string; iconOnly?: boolean; className?: string }) {
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
      className={className}
      onClick={handleClick}
      aria-pressed={speakingNow}
      aria-label={speakingNow ? 'Stop reading aloud' : label}
      title={iconOnly ? (speakingNow ? 'Stop reading aloud' : label) : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: iconOnly ? 0 : 6,
        width: iconOnly ? 28 : undefined,
        height: iconOnly ? 28 : undefined,
        borderRadius: iconOnly ? 8 : undefined,
        fontFamily: iconOnly ? undefined : 'var(--font-mono), monospace',
        fontSize: iconOnly ? undefined : 10,
        letterSpacing: iconOnly ? undefined : '0.10em',
        textTransform: iconOnly ? undefined : 'uppercase',
        color: speakingNow ? RED : FAINT,
        background: iconOnly ? (speakingNow ? 'rgba(219,26,26,0.08)' : 'rgba(42,36,32,0.05)') : 'none',
        border: iconOnly ? '1px solid rgba(42,36,32,0.10)' : 'none',
        cursor: 'pointer',
        padding: iconOnly ? 0 : 0,
        flexShrink: 0,
      }}
    >
      {speakingNow ? <Square size={iconOnly ? 13 : 11} strokeWidth={2} aria-hidden /> : <Volume2 size={iconOnly ? 14 : 12} strokeWidth={1.8} aria-hidden />}
      {!iconOnly && (speakingNow ? 'Stop' : label)}
    </button>
  )
}
