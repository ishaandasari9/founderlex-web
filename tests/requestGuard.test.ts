import { requireJsonContentType, readBodyWithLimit } from '../lib/requestGuard'

interface Case {
  name: string
  run: () => Promise<boolean> | boolean
}

function reqWithContentType(contentType: string | null): Request {
  const headers: Record<string, string> = {}
  if (contentType !== null) headers['content-type'] = contentType
  return new Request('http://localhost/api/test', { method: 'POST', headers })
}

function reqWithBody(body: string): Request {
  return new Request('http://localhost/api/test', { method: 'POST', body })
}

const cases: Case[] = [
  {
    name: 'accepts a plain application/json content type',
    run: () => requireJsonContentType(reqWithContentType('application/json')) === null,
  },
  {
    name: 'accepts application/json with a charset suffix',
    run: () => requireJsonContentType(reqWithContentType('application/json; charset=utf-8')) === null,
  },
  {
    name: 'accepts a case-insensitive content type',
    run: () => requireJsonContentType(reqWithContentType('Application/JSON')) === null,
  },
  {
    name: 'SECURITY: rejects missing content type (a bare cross-site request often has none)',
    run: () => typeof requireJsonContentType(reqWithContentType(null)) === 'string',
  },
  {
    name: 'SECURITY: rejects text/plain — the classic <form enctype="text/plain"> JSON-CSRF bypass',
    run: () => typeof requireJsonContentType(reqWithContentType('text/plain')) === 'string',
  },
  {
    name: 'SECURITY: rejects application/x-www-form-urlencoded (a "simple request" CORS type)',
    run: () => typeof requireJsonContentType(reqWithContentType('application/x-www-form-urlencoded')) === 'string',
  },
  {
    name: 'SECURITY: rejects multipart/form-data (a "simple request" CORS type)',
    run: () => typeof requireJsonContentType(reqWithContentType('multipart/form-data; boundary=----x')) === 'string',
  },
  {
    name: 'readBodyWithLimit returns the full body when under the limit',
    run: async () => {
      const result = await readBodyWithLimit(reqWithBody('{"hello":"world"}'), 1000)
      return result.text === '{"hello":"world"}' && !result.error
    },
  },
  {
    name: 'readBodyWithLimit returns an empty string for a bodyless request',
    run: async () => {
      const result = await readBodyWithLimit(new Request('http://localhost/api/test', { method: 'GET' }), 1000)
      return result.text === '' && !result.error
    },
  },
  {
    name: 'readBodyWithLimit accepts a body exactly at the byte limit',
    run: async () => {
      const body = 'a'.repeat(100)
      const result = await readBodyWithLimit(reqWithBody(body), 100)
      return result.text === body && !result.error
    },
  },
  {
    name: 'SECURITY: readBodyWithLimit rejects a body one byte past the limit, before JSON.parse ever runs',
    run: async () => {
      const result = await readBodyWithLimit(reqWithBody('a'.repeat(101)), 100)
      return !!result.error && result.error.includes('too large') && result.text === ''
    },
  },
  {
    name: 'SECURITY: readBodyWithLimit rejects a large body regardless of what Content-Length claims (defends against a lying/absent header)',
    run: async () => {
      // Body streams are read incrementally and measured directly — this
      // doesn't rely on trusting the Content-Length header at all.
      const huge = 'x'.repeat(50_000)
      const result = await readBodyWithLimit(reqWithBody(huge), 1000)
      return !!result.error && result.error.includes('too large')
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
