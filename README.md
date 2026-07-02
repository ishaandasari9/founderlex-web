# FounderLex

FounderLex is a guided legal-basics assistant for first-time founders — it explains startup legal concepts in plain English, interviews the founder to figure out which documents they need, and drafts starting-point documents from that profile. It is an educational tool, not a law firm, and is built with that boundary enforced in the code, not just the prompt (see "Trust & Delivery Layer" below).

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Trust & Delivery Layer (v3)

FounderLex answers legal questions and drafts legal documents — the two riskiest things an AI product can do wrong. The v3 build cycle added a layer of measurement and guardrails specifically so that "sounds right" isn't the bar; "measured, grounded, and fails closed" is.

### Accuracy benchmark

`tests/accuracy-runner.ts` runs a 35-question dataset (25 in-scope, 10 out-of-scope), drafted from the primary-source reference files in `skill/references/`, against the real assistant pipeline — the same `validateChatInput → extractProfile → validateProfile → selectReferenceFiles → getChatResponse` path a live request takes. An LLM judge grades each answer against hand-written `expected_key_points` / `must_not_say` criteria.

- **In-scope content accuracy: ~94–97%** (judge-graded; this number has natural single-run judge variance, so it's tracked as a range, not a fixed figure — see `tests/ACCURACY-RESULTS.md`)
- **Out-of-scope block rate: 10/10 (100%)** — deterministic, checked directly against `detectOutOfScope`, not judge-graded, zero tolerance

A separate ~55-case conversational stress suite (`tests/stress-runner.ts`) and a 10-scenario targeted edge-case suite (`tests/edge-case-runner.ts` — equity-split math, N-founder rendering, disguised out-of-scope requests, org-type ambiguity, reference grounding) run alongside it. Reports are regenerated and committed after any change that could plausibly move these numbers.

### Runtime verifier (fail-closed)

Before a substantive legal answer reaches the founder, `lib/runtimeVerifier.ts` sends it to a second, independent model call that checks it against the founder's question and the reference material it was supposedly grounded in, returning a structured verdict (`in_scope`, `supported_by_sources`, `contains_forbidden_verdict`, `issues`). Routing is fail-closed: a clean verdict shows the answer; a flagged one triggers one regeneration attempt with the issues fed back; if it's still flagged — or the verifier call itself errors or returns a malformed shape — the founder gets a safe fallback response, never the unverified draft.

### Inline source citations

Answers grounded in `skill/references/*.md` can surface a citation chip linking to the actual official source (IRS, USPTO TMEP, copyright.gov, FinCEN, state Secretary of State pages) — every URL hand-verified as a real, live, official page before being added to `lib/citations.ts`. Matching is claim-aware, not just topic-aware: each citation requires every one of its claim-component groups to match the model's actual answer (AND across groups, OR within a group's synonyms), so citing the 83(b) 30-day deadline requires the answer to actually state that deadline, not just mention "83(b)" in passing. If no reference genuinely supports the answer, no citation is shown — citations are never fabricated or inferred.

### One-click Founder Pack

From a confirmed founder profile and its recommended-document list, `lib/founderPack.ts` loops the same single-document generator (`lib/generateDocument.ts`) used everywhere else in the app — there is exactly one generation path, never a second one for batch mode. It produces every recommended document, runs the same validation on each one (equity-sum and required-field checks, plus a leaked-template-tag scan across all 15 document types), and bundles everything into a single zip: each document's `.docx` and `.pdf`, plus a plain-English cover memo (built on `lib/lawyerReviewEmail.ts`'s blank-detection helper) listing what's included, what each document is for, and every remaining `[TO BE COMPLETED]` blank. The same confirm-before-generating gate the single-document flow uses (`ConfirmDocPanel`) has a batch counterpart (`ConfirmPackPanel`) — generating a pack never skips confirmation.

## Engineering process

Every feature slice in this build cycle went through two-model adversarial review: Claude Code implements the feature and its regression tests, then Codex reviews the diff independently and blocks on anything it finds. Findings are fixed one at a time, each in its own commit with its own regression test, until Codex signs off — nothing ships past a blocking finding.

**Defense-in-depth, five independent layers** stand between a founder's question and what they see on screen — each one designed to catch what the layer before it might miss:

1. **Deterministic pre-filter** (`lib/outOfScopeGuard.ts`) — regex/keyword matching on categories that must never get a substantive answer (active disputes, criminal matters, securities offerings), checked before any model call.
2. **Grounded model answer** — the model answers using only the reference context `lib/selectReferences.ts` selected for that question, from `skill/references/*.md`.
3. **Runtime verifier** (`lib/runtimeVerifier.ts`) — a second, independent model call self-checks the draft answer for scope, grounding, and forbidden verdicts before it's shown; fails closed (see above).
4. **Forbidden-assertion output scan** (`lib/forbiddenAssertions.ts`) — a regex backstop that blocks any "safe to sign" / "you're covered" — style verdict from ever reaching the founder, in a chat reply or a document explanation, with Unicode confusables/homoglyph normalization (via the `confusables` package) so visually-similar characters can't be used to slip past the patterns.
5. **Template-baked disclaimer** — every generated document carries its "this is not legal advice" banner baked directly into the template file itself, not dependent on the model remembering to say it.

The deterministic test suite (run via `npm run test:*` — there's no jest/vitest; each test is a plain TypeScript script under `tests/`) grew by **300+ regression checks** across these four features alone, on top of the pre-existing suite, all green before any commit.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
