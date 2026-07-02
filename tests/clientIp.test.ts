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
    name: 'uses x-real-ip when present',
    run: () => getClientIp(reqWithHeaders({ 'x-real-ip': '203.0.113.5' })) === '203.0.113.5',
  },
  {
    name: 'a single-hop x-forwarded-for is used as-is',
    run: () => getClientIp(reqWithHeaders({ 'x-forwarded-for': '203.0.113.5' })) === '203.0.113.5',
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
    name: 'x-real-ip takes priority over x-forwarded-for when both are present',
    run: () => getClientIp(reqWithHeaders({
      'x-real-ip': '198.51.100.9',
      'x-forwarded-for': '9.9.9.9, 203.0.113.5',
    })) === '198.51.100.9',
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
