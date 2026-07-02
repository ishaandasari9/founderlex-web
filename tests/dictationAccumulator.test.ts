import { createDictationAccumulator } from '../lib/dictationAccumulator'

interface Case {
  name: string
  run: () => boolean
}

const cases: Case[] = [
  {
    name: 'update() with only final chunks builds up text across multiple calls',
    run: () => {
      const acc = createDictationAccumulator()
      acc.start('')
      acc.update('Hello', '')
      const result = acc.update('world', '')
      return result === 'Hello world '
    },
  },
  {
    name: 'update() shows a live interim preview without committing it to the base',
    run: () => {
      const acc = createDictationAccumulator()
      acc.start('')
      const preview = acc.update('', 'still talk')
      const committed = acc.update('still talking', '')
      return preview === 'still talk' && committed === 'still talking '
    },
  },
  {
    name: 'start() resets the base to the trimmed current value plus one trailing space',
    run: () => {
      const acc = createDictationAccumulator()
      acc.start('Existing draft  ')
      const result = acc.update('more words', '')
      return result === 'Existing draft more words '
    },
  },
  {
    name: 'start() with an empty value begins from a clean base',
    run: () => {
      const acc = createDictationAccumulator()
      acc.start('')
      return acc.update('fresh start', '') === 'fresh start '
    },
  },
  {
    name: 'sync() resyncs the base when the field changes externally (e.g. the user typed)',
    run: () => {
      const acc = createDictationAccumulator()
      acc.start('')
      acc.update('Hello', '')
      acc.sync('Hello there') // user edited the field by hand mid-session
      const result = acc.update('world', '')
      return result === 'Hello there world '
    },
  },
  {
    name: 'sync() is a no-op when the external value matches what this accumulator just emitted',
    run: () => {
      const acc = createDictationAccumulator()
      acc.start('')
      const emitted = acc.update('Hello', '')
      acc.sync(emitted) // the field's own onChange echo, not an external edit
      const result = acc.update('world', '')
      return result === 'Hello world '
    },
  },
  {
    name: 'BUG FIX: sending a message clears the field while dictation is still active — the next dictation must not resurrect the old, already-sent text',
    run: () => {
      const acc = createDictationAccumulator()
      acc.start('')
      const firstMessage = acc.update('Hello world', '')
      // Message sent: the parent clears the input out from under this
      // accumulator without the dictation session ever being stopped.
      acc.sync('')
      const secondMessage = acc.update('Second message', '')
      return firstMessage === 'Hello world ' &&
        secondMessage === 'Second message ' &&
        !secondMessage.includes('Hello world')
    },
  },
  {
    name: 'dictating into text the user already typed still appends onto it correctly',
    run: () => {
      const acc = createDictationAccumulator()
      acc.sync('Please review this') // simulates typing before ever starting dictation
      acc.start('Please review this')
      return acc.update('agreement', '') === 'Please review this agreement '
    },
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
