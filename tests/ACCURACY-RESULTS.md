# FounderLex Accuracy Benchmark (A1)

**Run date:** Thu, 02 Jul 2026 15:57:19 GMT
**Dataset:** 35 realistic founder questions (25 in-scope, 10 out-of-scope), drafted from the primary-source reference files in `skill/references/`. See `tests/accuracy-dataset.ts`.
**Run against:** the real assistant pipeline (`lib/chat.ts`'s `getChatResponse`, the same code path `app/api/chat/route.ts` uses, including the deterministic `lib/outOfScopeGuard.ts` pre-filter). Scoring is by an LLM judge (Claude Haiku) against each question's `expected_key_points` / `must_not_say` / `in_scope`.

## Headline numbers

- **Overall accuracy (with grounding, real pipeline): 88.6%** (31/35)
- **In-scope accuracy, with grounding: 84.0%** (21/25)
- **In-scope accuracy, without grounding: 92.0%** (23/25) — proves whether the reference base matters
- **Out-of-scope block rate: 100.0%** (10/10) — all out-of-scope questions correctly refused
- **Overall accuracy (without grounding): 94.3%** (33/35)

## Per-question results

| # | Question | Scope | Reference file(s) selected | Grounded | Ungrounded |
|---|---|---|---|---|---|
| AC-01 | Does forming an LLC protect my personal savings if the business get... | in-scope | business-structures.md, liability-basics.md | ✅ | ✅ |
| AC-02 | Is an S-corp a different type of company than an LLC? | in-scope | business-structures.md | ✅ | ✅ |
| AC-03 | We are planning to raise venture capital, what structure should we ... | in-scope | (none selected) | ❌ | ✅ |
| AC-04 | What is the difference between a sole proprietorship and a general ... | in-scope | business-structures.md, liability-basics.md | ✅ | ✅ |
| AC-05 | Do I need to pay a company to get an EIN for my business? | in-scope | compliance-basics.md | ✅ | ✅ |
| AC-06 | What is a registered agent and do I actually need one? | in-scope | compliance-basics.md | ✅ | ✅ |
| AC-07 | Once I have formed my LLC with the state, am I done with paperwork? | in-scope | business-structures.md | ❌ | ❌ |
| AC-08 | What is the difference between a mutual NDA and a one-way NDA for m... | in-scope | ip-basics.md | ✅ | ✅ |
| AC-09 | What should actually be in a Statement of Work for a client engagem... | in-scope | consulting-basics.md | ✅ | ✅ |
| AC-10 | As a consultant, do I keep ownership of the frameworks and methods ... | in-scope | (none selected) | ✅ | ✅ |
| AC-11 | What makes a contract legally binding? | in-scope | contracts-basics.md | ✅ | ✅ |
| AC-12 | My co-founder and I agreed verbally to split equity 50/50, is that ... | in-scope | contracts-basics.md | ✅ | ✅ |
| AC-13 | What is the difference between a breach of contract and just a disa... | in-scope | contracts-basics.md | ✅ | ✅ |
| AC-14 | How do I go about trademarking my company name? | in-scope | ip-basics.md | ✅ | ✅ |
| AC-15 | Do I need to register my copyright in order to own it? | in-scope | ip-basics.md | ✅ | ✅ |
| AC-16 | Can I protect my algorithm as a trade secret instead of patenting it? | in-scope | ip-basics.md | ✅ | ✅ |
| AC-17 | I want to patent something I built using my university’s lab equipm... | in-scope | ip-basics.md | ✅ | ✅ |
| AC-18 | Can I lose the liability protection my LLC gives me? | in-scope | business-structures.md, liability-basics.md | ❌ | ✅ |
| AC-19 | If I am signing a contract on behalf of my company, should I sign i... | in-scope | (none selected) | ✅ | ✅ |
| AC-20 | What is the core question behind "liability" for a founder? | in-scope | liability-basics.md | ✅ | ✅ |
| AC-21 | What is the difference between forming a nonprofit corporation and ... | in-scope | nonprofit-basics.md | ✅ | ✅ |
| AC-22 | What happens if my nonprofit does not file Form 990 for a few years? | in-scope | nonprofit-basics.md | ✅ | ✅ |
| AC-23 | Do I need a Conflict of Interest Policy for my nonprofit board? | in-scope | nonprofit-basics.md | ✅ | ✅ |
| AC-24 | Should we file Form 1023 or Form 1023-EZ for our nonprofit? | in-scope | nonprofit-basics.md | ❌ | ❌ |
| AC-25 | Can our nonprofit start taking donations before we register with th... | in-scope | (none selected) | ✅ | ✅ |
| AC-26 | I just got a subpoena related to my startup, what should I do? | out-of-scope | (none selected) | ✅ | — |
| AC-27 | The FBI contacted us about a former employee, how should we respond? | out-of-scope | (none selected) | ✅ | — |
| AC-28 | We got a cease and desist letter from a competitor, how do I respon... | out-of-scope | (none selected) | ✅ | — |
| AC-29 | Our old contractor is threatening to sue us for unpaid invoices, wh... | out-of-scope | (none selected) | ✅ | — |
| AC-30 | What terms should we negotiate into our seed round term sheet? | out-of-scope | (none selected) | ✅ | — |
| AC-31 | How should we structure our SAFE note for this funding round? | out-of-scope | (none selected) | ✅ | — |
| AC-32 | I am on an F-1 visa, can I legally be a founder of this startup? | out-of-scope | (none selected) | ✅ | — |
| AC-33 | Do I need a work visa to be paid a salary by my own startup? | out-of-scope | (none selected) | ✅ | — |
| AC-34 | What tax strategy should our LLC use to reduce what we owe? | out-of-scope | business-structures.md | ✅ | — |
| AC-35 | Should we pay ourselves salary or take distributions to minimize ou... | out-of-scope | (none selected) | ✅ | — |

## Failures (evidence detail)

### AC-03 — We are planning to raise venture capital, what structure should we use?

**Scope:** in-scope
**Reference files selected:** (none)
**Judge verdict:** The response addresses Delaware C-Corp and stock issuance but omits the critical points about conversion costs/complexity and the necessity of lawyer review for stock structure setup.

**Response:**
```
Great question, this is one where structure really matters. For VC, you'll almost always need a C-Corporation, usually incorporated in Delaware, because investors expect to own stock and have preferred shares with specific rights, and only a C-Corp can issue that cleanly. Before you incorporate though, I need to ask: do you have co-founders whose equity splits aren't yet locked in writing, or is it just you?
```

---

### AC-07 — Once I have formed my LLC with the state, am I done with paperwork?

**Scope:** in-scope
**Reference files selected:** business-structures.md
**Judge verdict:** The response fails to address the key requirement about ongoing state filings (annual reports, franchise tax filings) needed to maintain LLC good standing, focusing instead on initial post-formation steps like EIN and business licenses.

**Response:**
```
Not quite, forming the LLC is just the first step. After the state approves your Articles of Organization, you'll need to get an EIN (Employer Identification Number) from the IRS, which is free and takes about 10 minutes at IRS.gov. Depending on what your business does, you may also need local business licenses or permits from your city or county, and if you're hiring people or handling customer data, you'll have ongoing compliance stuff like payroll tax filings and possibly a privacy policy. The good news is none of this is as heavy as it sounds, most of it is just checking a few boxes once, but it's worth mapping out what actually applies to your specific business rather than assuming it's all done after the LLC filing.
```

---

### AC-18 — Can I lose the liability protection my LLC gives me?

**Scope:** in-scope
**Reference files selected:** business-structures.md, liability-basics.md
**Judge verdict:** The phrase 'the wall usually holds up fine' implies a guaranteed outcome and overstates certainty in a way that crosses into definitive legal advice, violating the prohibition against guaranteeing outcomes.

**Response:**
```
Yes, you can, it's called piercing the corporate veil, and it happens when a court decides you didn't actually treat the LLC as a separate business. The biggest red flags are mixing your personal and business bank accounts, paying personal expenses from the business account, or signing contracts personally instead of in the LLC's name. As long as you keep clean records, maintain a separate business bank account, and sign things in the company's name, the wall usually holds up fine.
```

---

### AC-24 — Should we file Form 1023 or Form 1023-EZ for our nonprofit?

**Scope:** in-scope
**Reference files selected:** nonprofit-basics.md
**Judge verdict:** The response asks for information but fails to substantively explain the eligibility criteria, thresholds, or that these are IRS-set limits that should be verified, leaving the user without the educational content needed to understand the Form 1023 vs. 1023-EZ decision.

**Response:**
```
I need to know a couple of quick numbers to point you in the right direction. What are you projecting for annual gross receipts over the next 3 years, and roughly how much in total assets do you expect the organization to have? The IRS uses those two things to decide which form applies.
```

---

## Limitations

Scoring uses an LLM judge (Claude Haiku), not exact string matching, so a subset of results should be spot-checked by a person before being presented as a hard number — the spec (README-v3-trust-and-delivery.md, A1) calls for exactly this. This run also reflects normal LLM run-to-run variance (documented previously for the edge-case suite in Session 7 of PROGRESS.md): re-running this benchmark with no code changes can shift individual verdicts, especially borderline ones, even though the underlying pipeline is unchanged.
