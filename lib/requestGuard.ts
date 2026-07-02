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
