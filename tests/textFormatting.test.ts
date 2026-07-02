import { stripMarkdownFormatting } from '../lib/textFormatting'

interface Case {
  name: string
  run: () => boolean
}

const cases: Case[] = [
  {
    name: 'strips bold and italic emphasis while keeping line breaks',
    run: () => {
      const result = stripMarkdownFormatting('Line one **bold**.\nLine two *italic*.')
      return result === 'Line one bold.\nLine two italic.'
    },
  },
  {
    name: 'strips heading markers but keeps the heading text',
    run: () => stripMarkdownFormatting('# Section One\nSome text.') === 'Section One\nSome text.',
  },
  {
    name: 'replaces em and en dashes with a comma',
    run: () => stripMarkdownFormatting('This — that.').includes(', ') &&
      stripMarkdownFormatting('This – that.').includes(', '),
  },
  {
    name: 'never leaves raw asterisks or heading symbols in the output',
    run: () => {
      const result = stripMarkdownFormatting('# Title\n**Bold** and *italic* text.')
      return !/[*#]/.test(result)
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
