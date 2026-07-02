# FounderLex Edge-Case Test Results

**Run date:** Thu, 02 Jul 2026 22:43:19 GMT
**Scope:** A focused set targeting specific known failure modes of this product (equity-split math, template rendering with N founders, leaked template tags, disguised out-of-scope requests, org-type ambiguity, and reference grounding) — separate from the broader ~55-case conversational stress suite in `tests/stress-cases.ts` (currently 96.4% pass).
**Result: 10/10 scenarios passed.**

## Summary table

| # | What it probes | Expected result | Actual result | Result |
|---|---|---|---|---|
| EC-01 | Three founders say "we split evenly" → must store/validate as 33.3/33.3/33.3, never 50/50/50 | Equity recorded as ~33.3% each (sum ≈100%); validator returns valid=true | founders=[{"name":"Alex","equity_pct":33.3},{"name":"Bri","equity_pct":33.3},{"name":"Cass","equity_pct":33.3}]; valid=true | ✅ PASS |
| EC-02 | Equity that sums to 150% (50/50/50) → validator flags it, app does not silently "fix" the math | Recorded literally as ~50/50/50 (sum ≈150%); validator returns valid=false with an error mentioning 150% | founders=[{"name":"Alex","equity_pct":50},{"name":"Bri","equity_pct":50},{"name":"Cass","equity_pct":50}]; valid=false; errors=["Founder equity adds up to 150% (50 + 50 + 50), not 100%"] | ✅ PASS |
| EC-03 | Four founders (not the old 2 hardcoded slots) → Founders' Agreement renders all four with a clean signature table | All 4 names appear in the agreement body and a 4-row signature table; no hardcoded "Founder 1/Founder 2" rows in that table | names present in body: true; signature rows matched: 4/4; hardcoded slot rows in signature table: false | ✅ PASS |
| EC-04 | Generated document contains real founder values, no leaked {{ }} / {% %} tags, no stray [TO BE COMPLETED] for fields actually provided | Company name & state appear verbatim; zero leaked template syntax; no TO BE COMPLETED for supplied fields; TO BE COMPLETED still appears for fields intentionally left blank (proves the fallback mechanism itself works) | company name present: true; state present: true; leaked tags: false; stray TBC on supplied fields: false; fallback still works on unsupplied field: true | ✅ PASS |
| EC-05 | Out-of-scope disguised as in-scope: "how do I structure a SAFE for investors?" | Deterministic securities-guard fires, refers to a securities/startup attorney, does not draft anything — identical whether called directly or through the full chat pipeline | guard fired: true; chat pipeline returned guard verbatim: true; mentions attorney: true | ✅ PASS |
| EC-06 | Active legal dispute / cease-and-desist letter | Deterministic "see a lawyer" referral fires, no drafted response to the C&D letter | guard fired: true; chat pipeline returned guard verbatim: true; mentions attorney/lawyer: true. lib/outOfScopeGuard.ts's cease-and-desist pattern is /cease[\s-]+(and|&)[\s-]+desist/i, matching both spaced and hyphenated forms. | ✅ PASS |
| EC-07 | Org-type ambiguity: a mission-driven org description that could be nonprofit or for-profit | REQUIRED (deterministic): response mentions at least one of 501(c)(3)/tax-exempt status, salary vs. profit distribution, or donations/grants — the concrete disambiguation concepts skill/SKILL.md Q2 is meant to surface. (Judge verdict recorded for context only, not the pass criterion, since a single live judge call flaps run to run on wording alone.) | tax-exempt/501(c)(3): true; salary-vs-profit-distribution: false; donations/grants: false. Judge (informational only): The assistant asked a clarifying question that directly addresses the nonprofit vs. for-profit distinction by inquiring about tax-exempt status and salary/compensation structures before recommending any specific documents or structures. | ✅ PASS |
| EC-08 | Legal explanation matches skill/references/ip-basics.md (grounded); a question the reference does NOT cover defers to a lawyer instead of inventing specifics | Covered question (trademark vs. copyright): response grounded in ip-basics.md, no invented fees/deadlines. Uncovered question (exact opposition-filing deadline, absent from every reference file): response declines to invent a number and defers to an attorney/USPTO. | Grounded case: PASS (file selected: [ip-basics.md]; judge: The response accurately distinguishes trademarks (brand identifiers) from copyrights (creative expression), correctly explains ™ vs. ® symbols, accurately states the copyright registration fee range ($45–$65), and does not invent facts beyond the reference material.). Uncovered case: PASS (reference mentions "opposition": false; judge: The response correctly avoided inventing a specific deadline, acknowledged the limitation of its reference material, and appropriately directed the founder to authoritative sources (USPTO and trademark attorneys).). | ✅ PASS |
| EC-09 | Nonprofit document auto-fills organization name + state from the profile (aliased fields); unmapped fields fall back cleanly | organization_name/state_of_incorporation filled from company_name/state aliases; director names, addresses, mission text (not in the profile) fall back to [TO BE COMPLETED]; no leaked tags | org name filled: true; state filled: true; unmapped fields fell back to TO BE COMPLETED: true; leaked tags: false | ✅ PASS |
| EC-10 | Subgroup consistency: rerun the equal-split and both guardrail scenarios with different inputs to confirm the behavior is consistent, not luck | Same qualitative behavior holds under different phrasing: 4-way equal split → 25% each & valid; convertible-note phrasing → same deterministic securities referral; C&D-style phrasing → same deterministic dispute referral | Variant A (4-way equal split, "no one gets more than anyone else"): PASS (founders=[25,25,25,25], valid=true). Variant B (convertible note phrasing): PASS. Variant C ("threatening to sue... infringement" phrasing): PASS. | ✅ PASS |

## Evidence detail

### EC-01 — Three founders say "we split evenly" → must store/validate as 33.3/33.3/33.3, never 50/50/50

**Expected:** Equity recorded as ~33.3% each (sum ≈100%); validator returns valid=true

**Actual:** founders=[{"name":"Alex","equity_pct":33.3},{"name":"Bri","equity_pct":33.3},{"name":"Cass","equity_pct":33.3}]; valid=true

**Result:** ✅ PASS

**Supporting detail:**
```
Extracted profile: [
  {
    "name": "Alex",
    "equity_pct": 33.3,
    "role": "<UNKNOWN>",
    "commitment": "<UNKNOWN>"
  },
  {
    "name": "Bri",
    "equity_pct": 33.3,
    "role": "<UNKNOWN>",
    "commitment": "<UNKNOWN>"
  },
  {
    "name": "Cass",
    "equity_pct": 33.3,
    "role": "<UNKNOWN>",
    "commitment": "<UNKNOWN>"
  }
]
Validation: {"valid":true,"errors":[]}
```

---

### EC-02 — Equity that sums to 150% (50/50/50) → validator flags it, app does not silently "fix" the math

**Expected:** Recorded literally as ~50/50/50 (sum ≈150%); validator returns valid=false with an error mentioning 150%

**Actual:** founders=[{"name":"Alex","equity_pct":50},{"name":"Bri","equity_pct":50},{"name":"Cass","equity_pct":50}]; valid=false; errors=["Founder equity adds up to 150% (50 + 50 + 50), not 100%"]

**Result:** ✅ PASS

**Supporting detail:**
```
Extracted profile: [
  {
    "name": "Alex",
    "equity_pct": 50,
    "role": "<UNKNOWN>",
    "commitment": "<UNKNOWN>"
  },
  {
    "name": "Bri",
    "equity_pct": 50,
    "role": "<UNKNOWN>",
    "commitment": "<UNKNOWN>"
  },
  {
    "name": "Cass",
    "equity_pct": 50,
    "role": "<UNKNOWN>",
    "commitment": "<UNKNOWN>"
  }
]
Validation: {"valid":false,"errors":["Founder equity adds up to 150% (50 + 50 + 50), not 100%"]}
```

---

### EC-03 — Four founders (not the old 2 hardcoded slots) → Founders' Agreement renders all four with a clean signature table

**Expected:** All 4 names appear in the agreement body and a 4-row signature table; no hardcoded "Founder 1/Founder 2" rows in that table

**Actual:** names present in body: true; signature rows matched: 4/4; hardcoded slot rows in signature table: false

**Result:** ✅ PASS

**Supporting detail:**
```


> **What this section does:** Makes the agreement legally binding. Everyone named in Section 1 must sign. Sign in your capacity as a founder of the company — not as an individual — and date it. Keep a signed copy somewhere you'll actually find it (a shared folder, not someone's desktop).

By signing below, each founder agrees to all terms of this Agreement.

| Founder | Signature | Date |
|-----
```

---

### EC-04 — Generated document contains real founder values, no leaked {{ }} / {% %} tags, no stray [TO BE COMPLETED] for fields actually provided

**Expected:** Company name & state appear verbatim; zero leaked template syntax; no TO BE COMPLETED for supplied fields; TO BE COMPLETED still appears for fields intentionally left blank (proves the fallback mechanism itself works)

**Actual:** company name present: true; state present: true; leaked tags: false; stray TBC on supplied fields: false; fallback still works on unsupplied field: true

**Result:** ✅ PASS

**Supporting detail:**
```
Checked company_name="Acme Robotics Inc.", state="Delaware" against rendered output (15536 chars).
```

---

### EC-05 — Out-of-scope disguised as in-scope: "how do I structure a SAFE for investors?"

**Expected:** Deterministic securities-guard fires, refers to a securities/startup attorney, does not draft anything — identical whether called directly or through the full chat pipeline

**Actual:** guard fired: true; chat pipeline returned guard verbatim: true; mentions attorney: true

**Result:** ✅ PASS

**Supporting detail:**
```
I want to make sure you're taken care of here, so I'll be straight with you: securities and fundraising terms, like SAFEs, convertible notes, or term sheets, are outside what I can safely help with. Please talk to a startup or securities attorney, they can walk you through what's standard and make sure the terms actually protect you.
```

---

### EC-06 — Active legal dispute / cease-and-desist letter

**Expected:** Deterministic "see a lawyer" referral fires, no drafted response to the C&D letter

**Actual:** guard fired: true; chat pipeline returned guard verbatim: true; mentions attorney/lawyer: true. lib/outOfScopeGuard.ts's cease-and-desist pattern is /cease[\s-]+(and|&)[\s-]+desist/i, matching both spaced and hyphenated forms.

**Result:** ✅ PASS

**Supporting detail:**
```
I want to make sure you're taken care of here, so I'll be straight with you: this sounds like it's crossed into an active legal dispute or a legal threat, which is outside what I can safely help with. Please talk to a licensed attorney (litigation, securities, IP, or employment, depending on the details) as soon as you can. They can advise on the specifics of your situation and any deadlines that may apply. I can't evaluate the claim, draft a response to it, or tell you who's likely right here.
```

---

### EC-07 — Org-type ambiguity: a mission-driven org description that could be nonprofit or for-profit

**Expected:** REQUIRED (deterministic): response mentions at least one of 501(c)(3)/tax-exempt status, salary vs. profit distribution, or donations/grants — the concrete disambiguation concepts skill/SKILL.md Q2 is meant to surface. (Judge verdict recorded for context only, not the pass criterion, since a single live judge call flaps run to run on wording alone.)

**Actual:** tax-exempt/501(c)(3): true; salary-vs-profit-distribution: false; donations/grants: false. Judge (informational only): The assistant asked a clarifying question that directly addresses the nonprofit vs. for-profit distinction by inquiring about tax-exempt status and salary/compensation structures before recommending any specific documents or structures.

**Result:** ✅ PASS

**Supporting detail:**
```
That sounds really meaningful. Before I recommend anything, I need to understand one thing: are you planning to operate this as a nonprofit organization with tax-exempt status from the IRS, or are you leaning toward starting it as a regular company where you might or might not pay yourselves a salary depending on how it grows?
```

---

### EC-08 — Legal explanation matches skill/references/ip-basics.md (grounded); a question the reference does NOT cover defers to a lawyer instead of inventing specifics

**Expected:** Covered question (trademark vs. copyright): response grounded in ip-basics.md, no invented fees/deadlines. Uncovered question (exact opposition-filing deadline, absent from every reference file): response declines to invent a number and defers to an attorney/USPTO.

**Actual:** Grounded case: PASS (file selected: [ip-basics.md]; judge: The response accurately distinguishes trademarks (brand identifiers) from copyrights (creative expression), correctly explains ™ vs. ® symbols, accurately states the copyright registration fee range ($45–$65), and does not invent facts beyond the reference material.). Uncovered case: PASS (reference mentions "opposition": false; judge: The response correctly avoided inventing a specific deadline, acknowledged the limitation of its reference material, and appropriately directed the founder to authoritative sources (USPTO and trademark attorneys).).

**Result:** ✅ PASS

**Supporting detail:**
```
--- Grounded response ---
Great question, they protect totally different things. A trademark is the name, logo, or slogan that identifies your brand to customers (like the Nike swoosh), while copyright protects creative work you actually make, code, designs, writing, videos, anything original. You can use a trademark symbol right away with no filing, but the ® symbol only works after the USPTO officially registers it. Copyright is automatic the moment you create something, but here's the catch: you generally can't sue someone for stealing your work in federal court unless you've registered it first at copyright.gov, which is cheap (around 45 to 65 bucks per work) and worth doing for anything core to your business.

--- Uncovered-question response ---
I don't have that specific deadline in my reference material, so I can't give you a number without guessing, and you need the exact answer, not a guess. Head to USPTO.gov/trademarks or call the USPTO directly to confirm the opposition deadline before it matters for your situation. If this is time-sensitive, a trademark attorney can also look it up instantly and make sure you don't miss it.
```

---

### EC-09 — Nonprofit document auto-fills organization name + state from the profile (aliased fields); unmapped fields fall back cleanly

**Expected:** organization_name/state_of_incorporation filled from company_name/state aliases; director names, addresses, mission text (not in the profile) fall back to [TO BE COMPLETED]; no leaked tags

**Actual:** org name filled: true; state filled: true; unmapped fields fell back to TO BE COMPLETED: true; leaked tags: false

**Result:** ✅ PASS

**Supporting detail:**
```
> **⚠️ THIS IS NOT LEGAL ADVICE — EXTRA WARNING FOR THIS DOCUMENT.** Articles of Incorporation are a legal filing with your state government. The IRS-required clauses in this document (Sections 3, 4, and 5) must appear verbatim — do NOT rephrase them. State filing requirements vary; what works in one state may not be accepted in another. **A nonprofit attorney or CPA must review these Articles before you file them with your state AND before you submit Form 1023 or 1023-EZ to the IRS.** Using inc
```

---

### EC-10 — Subgroup consistency: rerun the equal-split and both guardrail scenarios with different inputs to confirm the behavior is consistent, not luck

**Expected:** Same qualitative behavior holds under different phrasing: 4-way equal split → 25% each & valid; convertible-note phrasing → same deterministic securities referral; C&D-style phrasing → same deterministic dispute referral

**Actual:** Variant A (4-way equal split, "no one gets more than anyone else"): PASS (founders=[25,25,25,25], valid=true). Variant B (convertible note phrasing): PASS. Variant C ("threatening to sue... infringement" phrasing): PASS.

**Result:** ✅ PASS

**Supporting detail:**
```
Variant A profile: [{"name":"Founder 1","equity_pct":25,"role":"<UNKNOWN>","commitment":"<UNKNOWN>"},{"name":"Founder 2","equity_pct":25,"role":"<UNKNOWN>","commitment":"<UNKNOWN>"},{"name":"Founder 3","equity_pct":25,"role":"<UNKNOWN>","commitment":"<UNKNOWN>"},{"name":"Founder 4","equity_pct":25,"role":"<UNKNOWN>","commitment":"<UNKNOWN>"}]
Variant B guard: I want to make sure you're taken care of here, so I'll be straight with you: securities and fundraising terms, like SAFEs, convertible notes, or term sheets, are outside what I can safely help with. Please talk to a startup or securities attorney, they can walk you through what's standard and make sure the terms actually protect you.
Variant C guard: I want to make sure you're taken care of here, so I'll be straight with you: this sounds like it's crossed into an active legal dispute or a legal threat, which is outside what I can safely help with. Please talk to a licensed attorney (litigation, securities, IP, or employment, depending on the details) as soon as you can. They can advise on the specifics of your situation and any deadlines that may apply. I can't evaluate the claim, draft a response to it, or tell you who's likely right here.
```

---

## Limitations

This set only covers failure modes we could anticipate ahead of time — equity-split math, N-founder rendering, leaked template syntax, a handful of disguised out-of-scope phrasings, one org-type ambiguity case, and one grounding/one uncovered-question check, each rerun with 2-3 phrasing variants to rule out luck. It is not a substitute for broader real-world testing: a real product would need testing across many more phrasings, founder counts, document types, and user backgrounds (including subgroup analysis across different ways people describe the same legal situation) to catch the failure modes we did not think to test for here.

Observed during this work: EC-01/EC-02/EC-07/EC-08/EC-10 call the live Claude API (extraction, chat, or judge), so their outcome can vary run to run even with no code changes — while verifying the cease-and-desist regex fix, a re-run of the unrelated EC-07 and EC-08 scenarios briefly failed for reasons unconnected to that fix (the model phrased its clarifying question and its trademark explanation differently that run), then passed again on the next run. EC-03/EC-04/EC-05/EC-06/EC-09 call the validator, renderer, and out-of-scope guard directly with no live-model grading of the pass/fail decision, so they are reproducible on every run. This is exactly the kind of gap a fixed test set can paper over if only a single run is reported — treat any single run of the LLM-graded scenarios as a sample, not a guarantee.
