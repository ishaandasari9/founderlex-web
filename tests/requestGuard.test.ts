import { requireJsonContentType } from '../lib/requestGuard'

interface Case {
  name: string
  run: () => boolean
}

function reqWithContentType(contentType: string | null): Request {
  const headers: Record<string, string> = {}
  if (contentType !== null) headers['content-type'] = contentType
  return new Request('http://localhost/api/test', { method: 'POST', headers })
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
