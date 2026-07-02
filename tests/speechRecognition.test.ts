import {
  isSpeechRecognitionSupported,
  startDictation,
  type SpeechRecognitionLike,
  type SpeechRecognitionCtor,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionResultLike,
} from '../lib/speechRecognition'

interface Case {
  name: string
  run: () => boolean
}

class FakeRecognition extends EventTarget implements SpeechRecognitionLike {
  lang = ''
  continuous = false
  interimResults = false
  started = false
  stopped = false
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null
  onend: (() => void) | null = null
  start() { this.started = true }
  stop() { this.stopped = true }
  abort() {}
}

function result(transcript: string, isFinal: boolean): SpeechRecognitionResultLike {
  const arr = [{ transcript }] as unknown as SpeechRecognitionResultLike
  arr.isFinal = isFinal
  return arr
}

// Installs a fake `window.webkitSpeechRecognition`, runs fn, then tears it
// down. lib/speechRecognition.ts checks `typeof window` at call time, not at
// import time, so this doesn't require jsdom.
function withFakeWindow<T>(fn: (getInstance: () => FakeRecognition | null) => T): T {
  let instance: FakeRecognition | null = null
  const TrackedFakeRecognition = new Proxy(FakeRecognition, {
    construct(target, args) {
      const created = Reflect.construct(target, args) as FakeRecognition
      instance = created
      return created
    },
  }) as unknown as SpeechRecognitionCtor
  const fakeWindow = { webkitSpeechRecognition: TrackedFakeRecognition } as unknown as Window & typeof globalThis
  const original = (globalThis as { window?: Window }).window
  ;(globalThis as { window?: Window }).window = fakeWindow
  try {
    return fn(() => instance)
  } finally {
    ;(globalThis as { window?: Window }).window = original
  }
}

const cases: Case[] = [
  {
    name: 'isSpeechRecognitionSupported returns false outside a browser',
    run: () => isSpeechRecognitionSupported() === false,
  },
  {
    name: 'startDictation returns null (no-op, not a crash) when unsupported',
    run: () => startDictation({ onResult: () => {} }) === null,
  },
  {
    name: 'isSpeechRecognitionSupported is true once a recognition constructor exists on window',
    run: () => withFakeWindow(() => isSpeechRecognitionSupported() === true),
  },
  {
    name: 'startDictation configures continuous + interim results and calls start()',
    run: () => withFakeWindow((getInstance) => {
      startDictation({ onResult: () => {} })
      const instance = getInstance()
      return !!instance && instance.started && instance.continuous === true && instance.interimResults === true
    }),
  },
  {
    name: 'onResult separates already-final text from the still-interim tail',
    run: () => withFakeWindow((getInstance) => {
      let gotFinal = ''
      let gotInterim = ''
      startDictation({ onResult: (f, i) => { gotFinal = f; gotInterim = i } })
      getInstance()!.onresult!({
        resultIndex: 0,
        results: [result('hello world', true), result(' how are', false)],
      })
      return gotFinal === 'hello world' && gotInterim === ' how are'
    }),
  },
  {
    name: 'onResult only processes results from resultIndex onward, ignoring earlier finalized results',
    run: () => withFakeWindow((getInstance) => {
      let calls = 0
      let lastFinal = ''
      startDictation({ onResult: (f) => { calls++; lastFinal = f } })
      getInstance()!.onresult!({ resultIndex: 1, results: [result('already handled', true), result('new phrase', true)] })
      return calls === 1 && lastFinal === 'new phrase'
    }),
  },
  {
    name: 'controller.stop() calls stop() on the underlying recognition instance',
    run: () => withFakeWindow((getInstance) => {
      const controller = startDictation({ onResult: () => {} })
      controller!.stop()
      return getInstance()!.stopped === true
    }),
  },
  {
    name: 'onError forwards the recognition error code',
    run: () => withFakeWindow((getInstance) => {
      let gotError = ''
      startDictation({ onResult: () => {}, onError: (e) => { gotError = e } })
      getInstance()!.onerror!({ error: 'not-allowed' })
      return gotError === 'not-allowed'
    }),
  },
  {
    name: 'onEnd fires when recognition signals it ended',
    run: () => withFakeWindow((getInstance) => {
      const state = { ended: false }
      startDictation({ onResult: () => {}, onEnd: () => { state.ended = true } })
      getInstance()!.onend!()
      return state.ended === true
    }),
  },
]

let failures = 0

for (const c of cases) {
  const pass = c.run()
  if (pass) {
    console.log(`PASS  ${c.name}`)
  } else {
    failures++
    console.log(`FAIL  ${c.name}`)
  }
}

console.log(`\n${cases.length - failures}/${cases.length} passed`)
if (failures > 0) process.exit(1)
