import { isValidSessionId } from '../lib/sessionId'
import { randomUUID } from 'crypto'

interface Case {
  name: string
  run: () => boolean
}

const cases: Case[] = [
  {
    name: 'accepts a freshly minted randomUUID (the only kind the app issues)',
    run: () => {
      for (let i = 0; i < 100; i++) {
        if (!isValidSessionId(randomUUID())) return false
      }
      return true
    },
  },
  {
    name: 'accepts a canonical lowercase UUID',
    run: () => isValidSessionId('3f2504e0-4f89-41d3-9a0c-0305e82c3301') === true,
  },
  {
    name: 'accepts an uppercase UUID (case-insensitive)',
    run: () => isValidSessionId('3F2504E0-4F89-41D3-9A0C-0305E82C3301') === true,
  },
  {
    name: 'rejects null and undefined',
    run: () => isValidSessionId(null) === false && isValidSessionId(undefined) === false,
  },
  {
    name: 'rejects an empty string',
    run: () => isValidSessionId('') === false,
  },
  {
    name: 'rejects a non-UUID token',
    run: () => isValidSessionId('not-a-uuid') === false,
  },
  {
    name: 'rejects a truncated UUID',
    run: () => isValidSessionId('3f2504e0-4f89-41d3-9a0c') === false,
  },
  {
    name: 'rejects a UUID with extra/trailing characters (no injection tail)',
    run: () =>
      isValidSessionId('3f2504e0-4f89-41d3-9a0c-0305e82c3301 OR 1=1') === false &&
      isValidSessionId(' 3f2504e0-4f89-41d3-9a0c-0305e82c3301') === false,
  },
  {
    name: 'rejects non-hex characters inside the UUID shape',
    run: () => isValidSessionId('zzzzzzzz-4f89-41d3-9a0c-0305e82c3301') === false,
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
