// Thin wrapper around the browser's built-in SpeechSynthesis API. No network
// calls, no paid voice service — this only works where the browser supports it.

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined'
}

// Strips markdown so it reads as natural speech instead of "asterisk asterisk
// bold asterisk asterisk". Order matters — code/links are unwrapped before
// their surrounding emphasis markers would otherwise be stripped.
export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*-{3,}\s*$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\[TO BE COMPLETED:?\s*([^\]]*)\]/gi, 'blank: $1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '. ')
    .replace(/\.\s*\.+/g, '.')
    .replace(/\s+\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^\.\s*/, '')
}

type Listener = () => void

let currentUtteranceId: symbol | null = null
const listeners = new Set<Listener>()

function notify(): void {
  listeners.forEach(fn => fn())
}

// Returns an id you can compare against isSpeaking() to know whether *this*
// call is still the one playing (another speak() call elsewhere cancels it).
export function speakText(text: string): symbol | null {
  if (!isSpeechSupported()) return null
  const stripped = stripMarkdownForSpeech(text)
  if (!stripped) return null

  window.speechSynthesis.cancel()
  const id = Symbol('utterance')
  currentUtteranceId = id

  const utterance = new SpeechSynthesisUtterance(stripped)
  const clear = () => {
    if (currentUtteranceId === id) {
      currentUtteranceId = null
      notify()
    }
  }
  utterance.onend = clear
  utterance.onerror = clear

  window.speechSynthesis.speak(utterance)
  notify()
  return id
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return
  window.speechSynthesis.cancel()
  currentUtteranceId = null
  notify()
}

export function isSpeaking(id: symbol | null): boolean {
  return id !== null && currentUtteranceId === id
}

export function subscribeSpeechChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
