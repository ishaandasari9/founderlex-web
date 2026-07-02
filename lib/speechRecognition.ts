// Thin wrapper around the browser's built-in SpeechRecognition API
// (webkitSpeechRecognition in Chrome/Safari). No network calls, no paid
// service — dictation only works where the browser supports it.

export interface SpeechRecognitionResultLike {
  isFinal: boolean
  [index: number]: { transcript: string }
}

export interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

export interface SpeechRecognitionErrorEventLike {
  error: string
}

export interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null
}

export interface DictationHandlers {
  // Called on every recognition update. finalChunk is newly-finalized speech
  // (append it permanently); interimChunk is the still-being-recognized tail
  // (replace the previous interim with it, don't append).
  onResult: (finalChunk: string, interimChunk: string) => void
  onEnd?: () => void
  onError?: (error: string) => void
}

export interface DictationController {
  stop: () => void
}

export function startDictation(handlers: DictationHandlers): DictationController | null {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.lang = 'en-US'
  recognition.continuous = true
  recognition.interimResults = true

  recognition.onresult = (event) => {
    let finalChunk = ''
    let interimChunk = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const transcript = result[0]?.transcript ?? ''
      if (result.isFinal) finalChunk += transcript
      else interimChunk += transcript
    }
    handlers.onResult(finalChunk, interimChunk)
  }
  recognition.onerror = (event) => handlers.onError?.(event.error)
  recognition.onend = () => handlers.onEnd?.()

  recognition.start()

  return { stop: () => recognition.stop() }
}
