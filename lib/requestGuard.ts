// Blocks the classic cross-site "simple request" CSRF trick: a
// <form enctype="text/plain"> submission is not preflighted by CORS the way
// a real fetch() with Content-Type: application/json is, but its raw body
// can still be crafted as valid JSON text — and Request.json() parses the
// body regardless of what Content-Type header actually arrived. Any
// external page could otherwise silently trigger a paid model call, or a
// session write, from every visitor's browser. Every real client call in
// this app already sends Content-Type: application/json, so this is a
// no-op for legitimate traffic.
export function requireJsonContentType(req: Request): string | null {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return 'Expected a JSON request body.'
  }
  return null
}

export interface BodyReadResult {
  text: string
  error?: string
}

// req.json()/req.text() buffer the entire body into memory before any code
// gets a chance to check its size — a client can send an arbitrarily large
// or falsely-labeled body (Content-Length is attacker-controlled and easy to
// lie about) and force the server to fully receive and parse it regardless.
// This reads the body stream in chunks and aborts as soon as the running
// total exceeds the limit, so at most ~maxBytes plus one chunk is ever held
// in memory, independent of what Content-Length claims.
export async function readBodyWithLimit(req: Request, maxBytes: number): Promise<BodyReadResult> {
  if (!req.body) return { text: '' }

  const reader = req.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      return { text: '', error: `Request body is too large (limit ${maxBytes.toLocaleString()} bytes).` }
    }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()

  return { text }
}
