import { getClientIp } from '../lib/clientIp'

interface Case {
  name: string
  run: () => boolean
}

function reqWithHeaders(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/test', { headers })
}

const cases: Case[] = [
  {
    name: 'returns "unknown" when no relevant headers are present',
    run: () => getClientIp(reqWithHeaders({})) === 'unknown',
  },
  {
    name: 'uses x-forwarded-for when present (Vercel overwrites this header itself)',
    run: () => getClientIp(reqWithHeaders({ 'x-forwarded-for': '203.0.113.5' })) === '203.0.113.5',
  },
  {
    name: 'uses x-vercel-forwarded-for when present',
    run: () => getClientIp(reqWithHeaders({ 'x-vercel-forwarded-for': '203.0.113.5' })) === '203.0.113.5',
  },
  {
    name: 'x-vercel-forwarded-for takes priority over x-forwarded-for (more reliable if a proxy sits in front of Vercel)',
    run: () => getClientIp(reqWithHeaders({
      'x-vercel-forwarded-for': '198.51.100.9',
      'x-forwarded-for': '203.0.113.5',
    })) === '198.51.100.9',
  },
  {
    name: 'SECURITY (Codex regression): a forged x-real-ip must NOT win over a trusted x-forwarded-for',
    run: () => {
      // x-real-ip is not a header Vercel is documented to set, overwrite, or
      // otherwise protect — an earlier version of this function preferred it
      // over x-forwarded-for, which meant an attacker's own forged
      // x-real-ip could pass through unmodified and defeat the actually
      // trustworthy value entirely.
      return getClientIp(reqWithHeaders({
        'x-real-ip': '6.6.6.6',
        'x-forwarded-for': '203.0.113.5',
      })) === '203.0.113.5'
    },
  },
  {
    name: 'a bare forged x-real-ip with no x-forwarded-for at all is not trusted',
    run: () => getClientIp(reqWithHeaders({ 'x-real-ip': '6.6.6.6' })) === 'unknown',
  },
  {
    name: 'SECURITY: takes the LAST hop of x-forwarded-for, not the first, since the client can forge every hop except the one the trusted proxy appends',
    run: () => {
      // An attacker sends their own fabricated leading entry; a reverse proxy
      // appends the real, observed connecting IP as the final hop.
      return getClientIp(reqWithHeaders({ 'x-forwarded-for': '9.9.9.9, 203.0.113.5' })) === '203.0.113.5'
    },
  },
  {
    name: 'tolerates extra whitespace around hops',
    run: () => getClientIp(reqWithHeaders({ 'x-forwarded-for': '  9.9.9.9 ,  203.0.113.5  ' })) === '203.0.113.5',
  },
  {
    name: 'a trailing comma or empty hop does not produce an empty string result',
    run: () => getClientIp(reqWithHeaders({ 'x-forwarded-for': '203.0.113.5,' })) === '203.0.113.5',
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
