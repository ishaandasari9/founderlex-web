# IP Basics — Trademark, Copyright, Trade Secret, NDA, Patent

Educational reference for FounderLex. Ground IP explanations in this material; don't invent fees, deadlines, or statutory specifics beyond what's written here.

## Section 1 — Trademark

A trademark protects the words, names, logos, and slogans that identify your brand to customers — not the product itself.

- **™ vs. ®:** You can use ™ the moment you start using a name/logo in commerce, no filing required — it just signals you're claiming the mark. The ® symbol can only be used after the USPTO has actually registered the mark; using ® before registration is a legal violation.
- **Step 1 — Search first.** Before committing to a name, search USPTO TESS (Trademark Electronic Search System) at USPTO.gov/trademarks/search. Finding a conflict after you've built a brand, printed merchandise, or bought the domain is expensive and sometimes forces a rebrand. Also check the state you're forming in and common social handles/domains.
- **Step 2 — File if clear.** If the search comes back clean, file via TEAS Plus (the USPTO's streamlined online form) at USPTO.gov/trademarks/apply. Cost is roughly $250 per class of goods/services (a "class" is a category, e.g. software vs. clothing — filing in multiple classes multiplies the fee).
- **Scope:** A federal trademark gives nationwide protection, not just protection in your home state. State-level trademark registration exists but is much weaker and rarely worth prioritizing over the federal filing.
- **Timeline:** Federal registration typically takes several months to over a year depending on USPTO backlog and whether anyone objects.

## Section 2 — Copyright

Copyright protects original creative expression — code, written content, designs, images, video, music — the moment it's fixed in a tangible form.

- **Automatic vs. enforceable:** Copyright exists automatically the instant you create the work; you don't have to register it to own it. But you generally *cannot sue for infringement in federal court* until the work is registered with the U.S. Copyright Office.
- **Registration:** Cheap and fast relative to other IP — typically $45–$65 per work at copyright.gov for a basic single-work registration. Worth doing for anything core to the product (main codebase, key designs, branded content).
- **The contractor gap (critical):** Under U.S. copyright law, the *creator* of a work owns the copyright by default — even if you paid them — unless there's a signed agreement assigning it to you, or the work qualifies as a narrow "work made for hire" category (which independent contractor code/design usually does not, absent a specific written agreement). If a contractor or early collaborator built any part of the product without a signed IP-assignment clause, they may still legally own that copyright. This must be fixed immediately with a signed, retroactive assignment agreement — it becomes a serious blocker in investor due diligence if left unresolved.

## Section 3 — Trade Secret

A trade secret is information that has economic value *because* it isn't publicly known — algorithms, pricing models, customer lists, unpublished processes.

- **Protection is free, but conditional.** Unlike trademark/copyright/patent, there's no filing or registration. Legal protection exists only for as long as you actively keep the information secret.
- **What "actively keeping it secret" means in practice:** NDAs (mutual or one-way) with everyone who has access, access controls (not everyone on the team needs to see everything), and labeling sensitive documents "Confidential."
- **The tradeoff vs. patents:** A trade secret can protect something forever, as long as it stays secret — but if a competitor independently discovers or reverse-engineers the same thing, you have no recourse. A patent gives a stronger, time-limited exclusive right but requires public disclosure of exactly how the invention works.

## Section 4 — NDA (Non-Disclosure Agreement) Basics

An NDA is a contract that obligates one or both sides to keep certain information confidential.

- **Mutual vs. one-way:** A *mutual* NDA protects both parties as both disclosing and receiving party — the standard choice when two companies are exploring a deal, partnership, or investment and both will share sensitive information. A *one-way* (unilateral) NDA only protects the party disclosing information (e.g., a company briefing a single contractor who won't share anything back).
- **When it's needed:** Before sharing technical details, source code, financials, or a working prototype with someone outside the company — including potential investors, if you're sharing *how something works* rather than just the high-level concept. Investors generally will not sign an NDA before a first pitch meeting (they see too many ideas to sign blanket NDAs) — the NDA typically comes after they've expressed real interest and want deeper technical detail.
- **Key terms to get right:** a specific "Purpose" clause (narrower is stronger — vague purposes are harder to enforce), a clear definition of what counts as confidential, standard carve-outs (info that was already public, already known, independently developed, or required to be disclosed by law), and a defined confidentiality term (2–5 years past disclosure is typical for startup contexts; trade secrets can be carved out to last indefinitely).

## Section 5 — Patent

A patent gives the right to *exclude others* from making, using, selling, or importing an invention — it does not itself give you the right to make/sell the thing (you could still infringe someone else's patent while holding your own).

- **The tripod test.** To be patentable, an invention must be: useful (35 U.S.C. § 101), novel — genuinely new, not previously disclosed anywhere (35 U.S.C. § 102), and non-obvious to someone skilled in the field (35 U.S.C. § 103).
- **Who can be named:** Only human inventors can be listed on a patent. Companies own patents through a separate assignment document signed by the inventor(s) — this is why IP-assignment agreements with everyone who contributes technical work matter so much.
- **The statutory bar (most important rule):** Publicly disclosing an invention — a demo day pitch, a press release, a published paper, even certain public conversations — can start a clock that limits or permanently forecloses the ability to patent it later. **Talk to a patent attorney before any public disclosure of a potentially patentable invention.** This is generally not recoverable once the clock has run.
- **Real examples:** Amazon's "1-Click" checkout is U.S. Patent 5,960,411 (a method patent). Google's PageRank algorithm is U.S. Patent 6,285,999, filed by Larry Page while at Stanford, assigned to Stanford University, and licensed to Google — a canonical illustration of university IP ownership (see the university-resources note below).
- **Cost reality:** USPTO filing fees alone typically run $1,740+ for a non-provisional utility patent; with an attorney handling drafting and prosecution, total cost is commonly $10,000–$30,000+. Prosecution (the back-and-forth with the USPTO) usually takes 2–3 years. This is rarely a day-one priority for a student founder.
- **University IP policy:** If a student founder used university resources — a lab, equipment, computing, faculty advising, or grant funding — to build the invention, many universities' IP policies claim ownership of the resulting invention (the Stanford/PageRank example above is the canonical case). Founders in this situation should find and read their university's IP policy before assuming they personally own what they built.
- **Reading a patent (cover page anatomy):** A patent document has a **specification** (the detailed written description of the invention — how it works, how to make/use it) and **claims** (the precise numbered statements that define the actual legal scope of protection — this is what really matters for enforcement). Claims come in two flavors: **independent claims** stand alone and define the broadest protected scope; **dependent claims** refer back to an independent claim and narrow it further. Claim language also matters: "**comprising**" is broad — it means "including at least these elements, possibly more"; "**consisting of**" is narrow — it means "exactly these elements and nothing else."
