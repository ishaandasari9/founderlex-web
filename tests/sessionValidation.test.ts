import { validateSessionPayload, MAX_SESSION_PAYLOAD_CHARS } from '../lib/sessionValidation'

interface Case {
  name: string
  run: () => boolean
}

const cases: Case[] = [
  {
    name: 'accepts an empty session (no messages, no profile)',
    run: () => validateSessionPayload([], null) === null,
  },
  {
    name: 'accepts a normal-sized conversation history',
    run: () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({ role: 'user', text: `message ${i}` }))
      return validateSessionPayload(messages, { company_name: 'Acme' }) === null
    },
  },
  {
    name: 'SECURITY: rejects a payload larger than the cap',
    run: () => {
      const huge = [{ role: 'user', text: 'a'.repeat(MAX_SESSION_PAYLOAD_CHARS + 1000) }]
      const err = validateSessionPayload(huge, null)
      return typeof err === 'string' && err.includes('too large')
    },
  },
  {
    name: 'accepts a payload right at the boundary and rejects just past it',
    run: () => {
      // Reserve a little room for the JSON wrapper ({"messages":...,"profile":null})
      // around the raw text field.
      const overhead = JSON.stringify({ messages: [{ role: 'user', text: '' }], profile: null }).length
      const fits = 'a'.repeat(MAX_SESSION_PAYLOAD_CHARS - overhead)
      const tooMuch = fits + 'a'
      return validateSessionPayload([{ role: 'user', text: fits }], null) === null &&
        typeof validateSessionPayload([{ role: 'user', text: tooMuch }], null) === 'string'
    },
  },
  {
    name: 'treats undefined messages/profile the same as empty (matches route defaulting)',
    run: () => validateSessionPayload(undefined, undefined) === null,
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
