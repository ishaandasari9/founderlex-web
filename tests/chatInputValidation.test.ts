import { validateChatInput, MAX_MESSAGE_CHARS, MAX_MESSAGE_COUNT, type ChatMessage } from '../lib/chat'

interface Case {
  name: string
  run: () => boolean
}

function userMsg(content: string): ChatMessage {
  return { role: 'user', content }
}

function isOk(result: ReturnType<typeof validateChatInput>): boolean {
  return result.ok === true
}

function errorIncludes(result: ReturnType<typeof validateChatInput>, needle: string): boolean {
  return result.ok === false && result.error.includes(needle)
}

const cases: Case[] = [
  {
    name: 'accepts a normal short conversation',
    run: () => isOk(validateChatInput([userMsg('I want to start a company with a friend.')])),
  },
  {
    name: 'accepted input round-trips the exact validated messages',
    run: () => {
      const result = validateChatInput([userMsg('hello')])
      return result.ok === true && result.messages.length === 1 && result.messages[0].content === 'hello'
    },
  },
  {
    name: 'rejects a non-array input',
    run: () => errorIncludes(validateChatInput('not an array'), 'No message'),
  },
  {
    name: 'rejects an empty messages array',
    run: () => errorIncludes(validateChatInput([]), 'No message'),
  },
  {
    name: 'SECURITY: rejects a single oversized message (cost-drain guard)',
    run: () => errorIncludes(validateChatInput([userMsg('a'.repeat(10_000))]), 'too long'),
  },
  {
    name: 'accepts a message right at the per-message limit',
    run: () => isOk(validateChatInput([userMsg('a'.repeat(MAX_MESSAGE_CHARS))])),
  },
  {
    name: 'rejects a message one character past the per-message limit',
    run: () => errorIncludes(validateChatInput([userMsg('a'.repeat(MAX_MESSAGE_CHARS + 1))]), 'too long'),
  },
  {
    name: 'SECURITY: rejects a conversation whose combined length exceeds the total cap even if no single message is oversized',
    run: () => {
      const messages: ChatMessage[] = Array.from({ length: 20 }, () => userMsg('a'.repeat(3000)))
      return errorIncludes(validateChatInput(messages), 'too long')
    },
  },
  {
    name: 'accepts a long but reasonable multi-turn conversation under the total cap',
    run: () => {
      const messages: ChatMessage[] = Array.from({ length: 10 }, () => userMsg('a'.repeat(1000)))
      return isOk(validateChatInput(messages))
    },
  },
  {
    name: 'REGRESSION (Codex): rejects a message count over the cap even when every message is tiny',
    run: () => {
      const messages: ChatMessage[] = Array.from({ length: MAX_MESSAGE_COUNT + 1 }, () => userMsg('hi'))
      return errorIncludes(validateChatInput(messages), 'Too many messages')
    },
  },
  {
    name: 'accepts a message count right at the cap',
    run: () => {
      const messages: ChatMessage[] = Array.from({ length: MAX_MESSAGE_COUNT }, () => userMsg('hi'))
      return isOk(validateChatInput(messages))
    },
  },
  {
    name: 'REGRESSION (Codex): rejects non-string content (a number), which previously slipped past the length check silently',
    run: () => errorIncludes(validateChatInput([{ role: 'user', content: 12345 }]), 'text content'),
  },
  {
    name: 'REGRESSION (Codex): rejects non-string content (a large nested object), which could inflate real token cost undetected',
    run: () => errorIncludes(
      validateChatInput([{ role: 'user', content: { nested: 'x'.repeat(1_000_000) } }]),
      'text content',
    ),
  },
  {
    name: 'REGRESSION (Codex): rejects an invalid role instead of trusting whatever the client sends',
    run: () => errorIncludes(validateChatInput([{ role: 'system', content: 'hello' }]), 'role'),
  },
  {
    name: 'rejects a message missing a role entirely',
    run: () => errorIncludes(validateChatInput([{ content: 'hello' }]), 'role'),
  },
  {
    name: 'rejects a message missing content entirely',
    run: () => errorIncludes(validateChatInput([{ role: 'user' }]), 'text content'),
  },
  {
    name: 'rejects an array containing a non-object entry (e.g. a bare string)',
    run: () => errorIncludes(validateChatInput(['just a string', userMsg('hi')]), 'role'),
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
