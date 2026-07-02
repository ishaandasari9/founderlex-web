'use client'

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Mic, Square } from 'lucide-react'
import { isSpeechRecognitionSupported, startDictation, type DictationController } from '@/lib/speechRecognition'

const RED   = '#DB1A1A'
const FAINT = '#9B8F82'

const noopSubscribe = () => () => {}
// window exists once the client renders but not during SSR, so feature
// detection must go through useSyncExternalStore's server-snapshot path
// rather than a useState initializer, or hydration mismatches.
function useIsSupported(check: () => boolean): boolean {
  return useSyncExternalStore(noopSubscribe, check, () => false)
}

export default function MicButton({
  value, onChange, disabled,
}: { value: string; onChange: (next: string) => void; disabled?: boolean }) {
  const supported = useIsSupported(isSpeechRecognitionSupported)
  const [listening, setListening] = useState(false)
  const controllerRef = useRef<DictationController | null>(null)
  const baseTextRef = useRef('')

  useEffect(() => {
    return () => { controllerRef.current?.stop() }
  }, [])

  if (!supported) return null

  const stop = () => {
    controllerRef.current?.stop()
    controllerRef.current = null
    setListening(false)
  }

  const handleClick = () => {
    if (listening) {
      stop()
      return
    }

    baseTextRef.current = value.trim() ? `${value.trim()} ` : ''
    const controller = startDictation({
      onResult: (finalChunk, interimChunk) => {
        if (finalChunk) baseTextRef.current = `${baseTextRef.current}${finalChunk} `
        onChange(`${baseTextRef.current}${interimChunk}`)
      },
      onEnd: () => setListening(false),
      onError: (error) => {
        setListening(false)
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          alert('Microphone access was denied. Allow microphone access in your browser settings, then try again.')
        }
      },
    })
    if (controller) {
      controllerRef.current = controller
      setListening(true)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? 'Stop dictation' : 'Dictate a message'}
      style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: 9,
        border: 'none',
        background: listening ? RED : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {listening
        ? <Square size={14} color="#F7F2EB" strokeWidth={2} aria-hidden />
        : <Mic size={16} color={FAINT} strokeWidth={1.8} aria-hidden />}
    </button>
  )
}
