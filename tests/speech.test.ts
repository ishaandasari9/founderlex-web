import { isSpeechSupported, stripMarkdownForSpeech, speakText, stopSpeaking, isSpeaking } from '../lib/speech'

interface Case {
  name: string
  run: () => boolean
}

const cases: Case[] = [
  {
    name: 'isSpeechSupported returns false outside a browser (no window.speechSynthesis)',
    run: () => isSpeechSupported() === false,
  },
  {
    name: 'speakText and stopSpeaking are no-ops (not crashes) when unsupported',
    run: () => {
      const id = speakText('hello there')
      stopSpeaking()
      return id === null
    },
  },
  {
    name: 'isSpeaking is false for a null id',
    run: () => isSpeaking(null) === false,
  },
  {
    name: 'strips bold and italic emphasis markers',
    run: () => stripMarkdownForSpeech('This is **bold** and *italic* and __also bold__ and _also italic_.') ===
      'This is bold and italic and also bold and also italic.',
  },
  {
    name: 'strips inline code and fenced code blocks',
    run: () => {
      const out = stripMarkdownForSpeech('Run `npm install` then:\n```\nnpm run dev\n```\nDone.')
      return out.includes('Run npm install then') && !out.includes('`') && !out.includes('```')
    },
  },
  {
    name: 'strips heading markers but keeps the heading text',
    run: () => stripMarkdownForSpeech('# Section One\nSome text.') === 'Section One. Some text.',
  },
  {
    name: 'strips bullet and numbered list markers',
    run: () => {
      const out = stripMarkdownForSpeech('- First item\n- Second item\n1. Numbered item')
      return out === 'First item. Second item. Numbered item'
    },
  },
  {
    name: 'strips blockquote markers',
    run: () => stripMarkdownForSpeech('> A quoted note.') === 'A quoted note.',
  },
  {
    name: 'converts links to their visible text, dropping the URL',
    run: () => {
      const out = stripMarkdownForSpeech('See [the USPTO site](https://www.uspto.gov) for details.')
      return out === 'See the USPTO site for details.'
    },
  },
  {
    name: 'strips horizontal rules',
    run: () => {
      const out = stripMarkdownForSpeech('Above.\n\n---\n\nBelow.')
      return !out.includes('---')
    },
  },
  {
    name: 'reads [TO BE COMPLETED] blanks as "blank: ..." instead of literal brackets',
    run: () => stripMarkdownForSpeech('State: [TO BE COMPLETED: state].') === 'State: blank: state.',
  },
  {
    name: 'never leaves raw markdown symbols in the output',
    run: () => {
      const out = stripMarkdownForSpeech('# Title\n**Bold** *italic* `code` [link](url)\n> quote\n- item\n---')
      return !/[*_`#>[\]]/.test(out)
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
