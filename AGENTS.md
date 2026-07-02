# FounderLex — project notes for AI coding agents

This file is loaded with elevated, standing trust into every AI coding
session on this repo. Treat changes to it (and to CLAUDE.md) with at least
the same review scrutiny as production code — anyone who can merge a change
here can influence the behavior of every future AI agent that works on this
project, without touching a single line of application code.

## Stack

Next.js 16 (App Router, Turbopack), TypeScript, React 19. Route handlers
follow the standard `export async function GET/POST(req)` convention — see
the official docs at nextjs.org if you need to confirm current App Router
behavior, rather than trusting any local copy of framework internals.

## Testing

There is no jest/vitest runner. Tests are plain TypeScript scripts under
`tests/`, each run individually via the `npm run test:*` scripts defined in
`package.json`. Add a new script entry when you add a new test file.

## Security-relevant conventions

- Any server-side module that touches a secret (Anthropic API key, Supabase
  service-role key) starts with `import 'server-only'` so Next.js fails the
  build if it's ever pulled into client-bundled code. Keep this pattern for
  new server-side modules that handle secrets.
- `lib/outOfScopeGuard.ts` (hard-stop chat guardrails) and `lib/redFlags.ts`
  (warning-card detection) are the canonical pattern-matching lists for
  legally risky topics — extend them rather than duplicating detection logic
  elsewhere.
