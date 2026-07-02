// Pure state machine behind MicButton's transcript accumulation, kept
// separate from the React component so it can be unit tested directly.
//
// The bug this exists to prevent: if dictation is still active (never
// explicitly stopped) when the surrounding text field is cleared — e.g. the
// chat input clears itself after a message is sent — the base text must not
// keep holding the old, already-sent message. Otherwise the next chunk of
// speech gets appended onto stale text and reappears in the input.

export interface DictationAccumulator {
  // Call whenever the field's value changes for a reason other than this
  // accumulator's own emission (typed by the user, cleared, or reset after a
  // message is sent). Keeps the base in sync with reality.
  sync: (externalValue: string) => void
  // Call when starting a new dictation session; captures the field's current
  // value as the base to append onto.
  start: (currentValue: string) => void
  // Call for every recognition result. Returns the full string to display.
  update: (finalChunk: string, interimChunk: string) => string
}

function baseFromValue(value: string): string {
  const trimmed = value.trim()
  return trimmed ? `${trimmed} ` : ''
}

export function createDictationAccumulator(): DictationAccumulator {
  let base = ''
  let lastEmitted = ''

  return {
    sync(externalValue) {
      if (externalValue !== lastEmitted) {
        base = baseFromValue(externalValue)
        lastEmitted = externalValue
      }
    },
    start(currentValue) {
      base = baseFromValue(currentValue)
    },
    update(finalChunk, interimChunk) {
      if (finalChunk) base = `${base}${finalChunk} `
      const next = `${base}${interimChunk}`
      lastEmitted = next
      return next
    },
  }
}
