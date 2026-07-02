import { finalizeWebSearchReply, extractTextAndSources, searchNameOnWeb } from '../lib/nameWebSearch'
import { NAME_SEARCH_DISCLAIMER } from '../lib/nameSearch'

interface Case {
  name: string
  run: () => Promise<boolean> | boolean
}

const cases: Case[] = [
  {
    name: 'finalizeWebSearchReply appends the exact required disclaimer verbatim',
    run: () => finalizeWebSearchReply('Found a similar business called Acme Corp in California.').endsWith(NAME_SEARCH_DISCLAIMER),
  },
  {
    name: 'EXACT DISCLAIMER TEXT: matches the mandated sentence byte-for-byte',
    run: () => NAME_SEARCH_DISCLAIMER === 'This is an early research tool, not a trademark clearance opinion. Similar results do not automatically mean you cannot use a name, and no results do not mean the name is safe. A trademark attorney should review before you spend money on branding, file a trademark application, or launch publicly.',
  },
  {
    name: 'SECURITY: replaces the whole reply with a safe fallback if a forbidden assertion slips through ("safe to use")',
    run: () => {
      const result = finalizeWebSearchReply('Based on what I found, this name is safe to use, go ahead and register it.')
      return result.includes("wasn't able to put together") && result.endsWith(NAME_SEARCH_DISCLAIMER)
    },
  },
  {
    name: 'SECURITY: catches a markdown-split forbidden phrase via the shared normalized detector',
    run: () => {
      const result = finalizeWebSearchReply('This name looks **safe to sign** off on and register.')
      return result.includes("wasn't able to put together")
    },
  },
  {
    name: 'SECURITY: catches a paraphrased green-light via the shared detector',
    run: () => {
      const result = finalizeWebSearchReply("I'd be comfortable signing off on this one, it's a green light.")
      return result.includes("wasn't able to put together")
    },
  },
  {
    name: 'does not flag a normal, appropriately-scoped summary',
    run: () => {
      const result = finalizeWebSearchReply('I found a company called Acme Robotics Inc. registered in Delaware, in the consumer robotics space. No other close matches turned up in general web results.')
      return !result.includes("wasn't able to put together")
    },
  },
  {
    name: 'strips markdown formatting from a normal reply',
    run: () => !/[*#]/.test(finalizeWebSearchReply('I found **Acme Corp**, a similar company in *California*.')),
  },
  {
    name: 'does not duplicate a disclaimer the model already attempted',
    run: () => {
      const withAttempt = `Found nothing similar.\n\n${NAME_SEARCH_DISCLAIMER}`
      const result = finalizeWebSearchReply(withAttempt)
      const occurrences = (result.match(/early research tool/g) ?? []).length
      return occurrences === 1 && result.endsWith(NAME_SEARCH_DISCLAIMER)
    },
  },
  {
    name: 'extractTextAndSources concatenates all text blocks and dedupes citations by URL',
    run: () => {
      const content = [
        {
          type: 'text',
          text: 'Found a similar org.',
          citations: [{ type: 'web_search_result_location', url: 'https://example.com/a', title: 'Example A' }],
        },
        { type: 'server_tool_use', id: 'x', name: 'web_search' },
        {
          type: 'text',
          text: 'It is in a different industry.',
          citations: [
            { type: 'web_search_result_location', url: 'https://example.com/a', title: 'Example A' },
            { type: 'web_search_result_location', url: 'https://example.com/b', title: 'Example B' },
          ],
        },
      ]
      const { text, sources } = extractTextAndSources(content)
      return text.includes('Found a similar org.') &&
        text.includes('different industry') &&
        sources.length === 2 &&
        sources[0].url === 'https://example.com/a' &&
        sources[1].url === 'https://example.com/b'
    },
  },
  {
    name: 'extractTextAndSources ignores non-text blocks entirely (server_tool_use, web_search_tool_result)',
    run: () => {
      const content = [
        { type: 'server_tool_use', id: 'x', name: 'web_search' },
        { type: 'web_search_tool_result', tool_use_id: 'x', content: [] },
      ]
      const { text, sources } = extractTextAndSources(content)
      return text === '' && sources.length === 0
    },
  },
  {
    name: 'extractTextAndSources falls back to the URL as the title when a citation title is missing',
    run: () => {
      const content = [
        { type: 'text', text: 'hello', citations: [{ type: 'web_search_result_location', url: 'https://example.com/c', title: null }] },
      ]
      const { sources } = extractTextAndSources(content)
      return sources.length === 1 && sources[0].title === 'https://example.com/c'
    },
  },
  {
    name: 'searchNameOnWeb rejects empty input without making a network call',
    run: async () => {
      try {
        await searchNameOnWeb('   ')
        return false
      } catch {
        return true
      }
    },
  },
]

let failures = 0

async function main() {
  for (const c of cases) {
    const pass = await c.run()
    if (pass) {
      console.log(`PASS  ${c.name}`)
    } else {
      failures++
      console.log(`FAIL  ${c.name}`)
    }
  }

  console.log(`\n${cases.length - failures}/${cases.length} passed`)
  if (failures > 0) process.exit(1)
}

main()
