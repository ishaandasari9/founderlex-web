import { validateChatInput, type ChatMessage } from '../lib/chat'

interface Case {
  name: string
  run: () => boolean
}

function userMsg(content: string): ChatMessage {
  return { role: 'user', content }
}

const cases: Case[] = [
  {
    name: 'accepts a normal short conversation',
    run: () => validateChatInput([userMsg('I want to start a company with a friend.')]) === null,
  },
  {
    name: 'rejects an empty messages array',
    run: () => typeof validateChatInput([]) === 'string',
  },
  {
    name: 'SECURITY: rejects a single oversized message (cost-drain guard)',
    run: () => {
      const huge = 'a'.repeat(10_000)
      const err = validateChatInput([userMsg(huge)])
      return typeof err === 'string' && err.includes('too long')
    },
  },
  {
    name: 'accepts a message right at the per-message limit',
    run: () => validateChatInput([userMsg('a'.repeat(4000))]) === null,
  },
  {
    name: 'rejects a message one character past the per-message limit',
    run: () => typeof validateChatInput([userMsg('a'.repeat(4001))]) === 'string',
  },
  {
    name: 'SECURITY: rejects a conversation whose combined length exceeds the total cap even if no single message is oversized',
    run: () => {
      const messages: ChatMessage[] = Array.from({ length: 20 }, () => userMsg('a'.repeat(3000)))
      const err = validateChatInput(messages)
      return typeof err === 'string' && err.includes('too long')
    },
  },
  {
    name: 'accepts a long but reasonable multi-turn conversation under the total cap',
    run: () => {
      const messages: ChatMessage[] = Array.from({ length: 10 }, () => userMsg('a'.repeat(1000)))
      return validateChatInput(messages) === null
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
