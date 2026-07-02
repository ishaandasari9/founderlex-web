# FounderLex Accuracy Benchmark (A1)

**Run date:** Thu, 02 Jul 2026 16:52:33 GMT
**Dataset:** 35 realistic founder questions (25 in-scope, 10 out-of-scope), drafted from the primary-source reference files in `skill/references/`. See `tests/accuracy-dataset.ts`.
**Run against:** the real assistant pipeline — the same steps `app/api/chat/route.ts` runs for a live request: `validateChatInput` → `extractProfile` → `validateProfile` → `describeProfile` → `selectReferenceFiles` (using the extracted `business_type`, not a hardcoded null) → `getChatResponse` (including the deterministic `lib/outOfScopeGuard.ts` pre-filter and the `finalizeChatResponse` output backstop). Scoring is by an LLM judge (Claude Haiku) against each question's `expected_key_points` / `must_not_say` / `in_scope`.

## Headline numbers

- **Overall accuracy (with grounding, real pipeline): 94.3%** (33/35)
- **In-scope accuracy, with grounding: 92.0%** (23/25)
- **In-scope accuracy, without grounding: 88.0%** (22/25) — proves whether the reference base matters
- **Out-of-scope block rate: 100.0%** (10/10) — all out-of-scope questions correctly refused
- **Overall accuracy (without grounding): 91.4%** (32/35)

## Per-question results

| # | Question | Scope | Extracted business_type | Reference file(s) selected | Grounded | Ungrounded |
|---|---|---|---|---|---|---|
| AC-01 | Does forming an LLC protect my personal savings if the business get... | in-scope | (none) | business-structures.md, liability-basics.md | ✅ | ✅ |
| AC-02 | Is an S-corp a different type of company than an LLC? | in-scope | (none) | business-structures.md | ✅ | ✅ |
| AC-03 | We are planning to raise venture capital, what structure should we ... | in-scope | (none) | business-structures.md | ✅ | ✅ |
| AC-04 | What is the difference between a sole proprietorship and a general ... | in-scope | (none) | business-structures.md, liability-basics.md | ✅ | ❌ |
| AC-05 | Do I need to pay a company to get an EIN for my business? | in-scope | (none) | compliance-basics.md | ✅ | ✅ |
| AC-06 | What is a registered agent and do I actually need one? | in-scope | (none) | compliance-basics.md | ✅ | ✅ |
| AC-07 | Once I have formed my LLC with the state, am I done with paperwork? | in-scope | (none) | business-structures.md, compliance-basics.md | ✅ | ✅ |
| AC-08 | What is the difference between a mutual NDA and a one-way NDA for m... | in-scope | consulting | ip-basics.md, consulting-basics.md | ✅ | ✅ |
| AC-09 | What should actually be in a Statement of Work for a client engagem... | in-scope | consulting | consulting-basics.md | ✅ | ✅ |
| AC-10 | As a consultant, do I keep ownership of the frameworks and methods ... | in-scope | consulting | consulting-basics.md | ✅ | ✅ |
| AC-11 | What makes a contract legally binding? | in-scope | (none) | contracts-basics.md | ✅ | ✅ |
| AC-12 | My co-founder and I agreed verbally to split equity 50/50, is that ... | in-scope | (none) | contracts-basics.md | ✅ | ✅ |
| AC-13 | What is the difference between a breach of contract and just a disa... | in-scope | (none) | contracts-basics.md | ✅ | ✅ |
| AC-14 | How do I go about trademarking my company name? | in-scope | (none) | ip-basics.md | ✅ | ❌ |
| AC-15 | Do I need to register my copyright in order to own it? | in-scope | (none) | ip-basics.md | ✅ | ✅ |
| AC-16 | Can I protect my algorithm as a trade secret instead of patenting it? | in-scope | (none) | ip-basics.md | ✅ | ✅ |
| AC-17 | I want to patent something I built using my university’s lab equipm... | in-scope | product | ip-basics.md | ✅ | ✅ |
| AC-18 | Can I lose the liability protection my LLC gives me? | in-scope | (none) | business-structures.md, liability-basics.md | ❌ | ✅ |
| AC-19 | If I am signing a contract on behalf of my company, should I sign i... | in-scope | (none) | liability-basics.md | ✅ | ❌ |
| AC-20 | What is the core question behind "liability" for a founder? | in-scope | (none) | liability-basics.md | ✅ | ✅ |
| AC-21 | What is the difference between forming a nonprofit corporation and ... | in-scope | (none) | nonprofit-basics.md | ✅ | ✅ |
| AC-22 | What happens if my nonprofit does not file Form 990 for a few years? | in-scope | nonprofit | nonprofit-basics.md | ✅ | ✅ |
| AC-23 | Do I need a Conflict of Interest Policy for my nonprofit board? | in-scope | nonprofit | nonprofit-basics.md | ✅ | ✅ |
| AC-24 | Should we file Form 1023 or Form 1023-EZ for our nonprofit? | in-scope | nonprofit | nonprofit-basics.md | ❌ | ✅ |
| AC-25 | Can our nonprofit start taking donations before we register with th... | in-scope | nonprofit | nonprofit-basics.md | ✅ | ✅ |
| AC-26 | I just got a subpoena related to my startup, what should I do? | out-of-scope | (none) | (none selected) | ✅ | — |
| AC-27 | The FBI contacted us about a former employee, how should we respond? | out-of-scope | (none) | (none selected) | ✅ | — |
| AC-28 | We got a cease and desist letter from a competitor, how do I respon... | out-of-scope | (none) | (none selected) | ✅ | — |
| AC-29 | Our old contractor is threatening to sue us for unpaid invoices, wh... | out-of-scope | (none) | (none selected) | ✅ | — |
| AC-30 | What terms should we negotiate into our seed round term sheet? | out-of-scope | (none) | (none selected) | ✅ | — |
| AC-31 | How should we structure our SAFE note for this funding round? | out-of-scope | (none) | (none selected) | ✅ | — |
| AC-32 | I am on an F-1 visa, can I legally be a founder of this startup? | out-of-scope | (none) | (none selected) | ✅ | — |
| AC-33 | Do I need a work visa to be paid a salary by my own startup? | out-of-scope | (none) | (none selected) | ✅ | — |
| AC-34 | What tax strategy should our LLC use to reduce what we owe? | out-of-scope | (none) | business-structures.md | ✅ | — |
| AC-35 | Should we pay ourselves salary or take distributions to minimize ou... | out-of-scope | (none) | (none selected) | ✅ | — |

## Failures (evidence detail)

### AC-18 — Can I lose the liability protection my LLC gives me?

**Scope:** in-scope
**Reference files selected:** business-structures.md, liability-basics.md
**Judge verdict:** The response fails to address the substantive question about piercing the corporate veil, examples of when liability protection is lost, or practical steps to maintain the shield—it only includes a disclaimer without any educational content.

**Response:**
```
I don't want to overstate that last answer, so let me back up: please don't treat what I just said as a guarantee, and check the specifics with a licensed attorney before relying on it.
```

---

### AC-24 — Should we file Form 1023 or Form 1023-EZ for our nonprofit?

**Scope:** in-scope
**Reference files selected:** nonprofit-basics.md
**Judge verdict:** The response fails to include the critical disclaimer that dollar thresholds and fees can change and must be verified at irs.gov, and does not explicitly direct the founder to consult a CPA or nonprofit attorney for the actual eligibility determination and filing.

**Response:**
```
I can help you figure out which one fits your situation, but I need one piece of info first: what's your nonprofit projecting for annual gross receipts over the next three years, and what's your total assets? The eligibility basically comes down to those two numbers, if you're expecting $50,000 or less per year and have $250,000 or less in assets, you'd likely qualify for the simpler 1023-EZ, which is faster and cheaper. If you're above either of those thresholds, the full Form 1023 is what you'd need.
```

---

## Limitations

Scoring uses an LLM judge (Claude Haiku), not exact string matching, so a subset of results should be spot-checked by a person before being presented as a hard number — the spec (README-v3-trust-and-delivery.md, A1) calls for exactly this. This run also reflects normal LLM run-to-run variance (documented previously for the edge-case suite in Session 7 of PROGRESS.md): re-running this benchmark with no code changes can shift individual verdicts, especially borderline ones, even though the underlying pipeline is unchanged.
