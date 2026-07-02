// Regression test for lib/founderPack.ts (B2, README-v3-trust-and-
// delivery.md Part B). Deterministic, no API calls — exercises the real
// render/docx/pdf pipeline (via generateDocument) against actual template
// files on disk, same as generateDocument.test.ts.
import { resolveRecommendedTemplates, buildCoverMemo, generateFounderPack, type FounderPackDoc } from '../lib/founderPack'
import { emptyProfile, validateProfile, type FounderProfile } from '../lib/founderProfile'
import { TEMPLATE_FILES } from '../lib/generateDocument'
import { TEMPLATE_LABELS } from '../lib/templateMeta'

let checks = 0
let failures = 0

function check(condition: boolean, message: string) {
  checks++
  if (condition) {
    console.log(`PASS  ${message}`)
  } else {
    console.log(`FAIL  ${message}`)
    failures++
  }
}

function baseProfile(overrides: Partial<FounderProfile> = {}): FounderProfile {
  return {
    ...emptyProfile(),
    company_name: 'Acme Robotics Inc.',
    product_description: 'a marketplace app connecting student robotics teams with mentors',
    business_type: 'product',
    structure: 'Delaware C-Corp',
    state: 'Delaware',
    registered: true,
    founders: [
      { name: 'Ari Chen', equity_pct: 50, role: 'CEO', commitment: 'full-time' },
      { name: 'Bex Molina', equity_pct: 50, role: 'CTO', commitment: 'full-time' },
    ],
    ...overrides,
  }
}

async function main() {
  // ── resolveRecommendedTemplates ─────────────────────────────────────────
  check(
    JSON.stringify(resolveRecommendedTemplates(baseProfile({ recommended_documents: ["Founders' Agreement", 'Mutual NDA'] })))
      === JSON.stringify(['founders_agreement', 'mutual_nda']),
    'resolves realistic free-text recommendations to the correct template_name keys, in order',
  )
  check(
    resolveRecommendedTemplates(baseProfile({ recommended_documents: ["Founders' Agreement", "Founders' Agreement"] })).length === 1,
    'dedupes a recommendation mentioned twice',
  )
  check(
    resolveRecommendedTemplates(baseProfile({ recommended_documents: ["Founders' Agreement", 'Some made-up document nobody makes'] }))
      .length === 1,
    'an unresolvable recommendation is silently dropped, not an error, and does not block the rest',
  )
  check(
    resolveRecommendedTemplates(baseProfile({ recommended_documents: [] })).length === 0,
    'no recommendations resolves to an empty list',
  )

  // ── REQUIRED (B2): generateFounderPack throws when there is nothing to
  // generate, rather than silently returning an empty pack ────────────────
  {
    let threw = false
    try {
      await generateFounderPack(baseProfile({ recommended_documents: [] }))
    } catch {
      threw = true
    }
    check(threw, 'generateFounderPack throws when recommended_documents resolves to nothing')
  }

  // ── REQUIRED (B2): "pack contains exactly the recommended docs" ─────────
  {
    const profile = baseProfile({ recommended_documents: ["Founders' Agreement", 'Mutual NDA', 'Privacy Policy'] })
    const result = await generateFounderPack(profile)
    const templateNames = result.docs.map((d) => d.template_name).sort()
    check(
      JSON.stringify(templateNames) === JSON.stringify(['founders_agreement', 'mutual_nda', 'privacy_policy']),
      `REQUIRED: the pack contains exactly the recommended docs, no more, no fewer — got: ${JSON.stringify(templateNames)}`,
    )
    check(result.docs.length === 3, 'the pack has exactly 3 documents for 3 recommendations')
    check(
      result.docs.every((d) => !/\{\{|\{%/.test(d.filled)),
      'no leaked template tags in any document in this pack',
    )
    check(
      result.docs.every((d) => d.docx_b64.length > 0 && d.pdf_b64.length > 0),
      'every document in the pack has both a non-empty docx and pdf',
    )
  }

  // ── REQUIRED (B2): every template type, generated together as a single
  // pack (not just individually via generateDocument), still passes the
  // template-leak test. ────────────────────────────────────────────────────
  //
  // Note: "Independent Contractor Agreement" contains "contractor
  // agreement" as a substring, so detectTemplate resolves it to
  // contractor_agreement before it can ever reach
  // independent_contractor_consulting's own, more specific keyword — a
  // pre-existing keyword-matcher property (not introduced here, and not
  // touched, since it also drives live chat doc-card detection). Both keys
  // point at the identical underlying template file
  // (lib/templates/independent-contractor.md) anyway, so all 15 labels
  // resolve to 14 distinct generatable documents, not a missed template.
  {
    const allLabels = Object.values(TEMPLATE_LABELS)
    const profile = baseProfile({ recommended_documents: allLabels })
    const result = await generateFounderPack(profile)
    const expectedDistinctCount = Object.keys(TEMPLATE_FILES).length - 1
    check(
      result.docs.length === expectedDistinctCount,
      `REQUIRED (B2): a pack built from all 15 labels resolves and generates ${expectedDistinctCount} distinct documents (got ${result.docs.length})`,
    )
    for (const d of result.docs) {
      check(!/\{\{|\{%/.test(d.filled), `REQUIRED (B2): ${d.template_name} has no leaked template tags when generated as part of a full pack`)
    }
  }

  // ── REQUIRED (B2): cover memo lists remaining blanks ────────────────────
  {
    // A profile with no state/structure set leaves those fields as
    // [TO BE COMPLETED] in the rendered document.
    const profile = baseProfile({ state: null, structure: null, recommended_documents: ["Founders' Agreement"] })
    const result = await generateFounderPack(profile)
    check(result.docs.length === 1, 'sanity: exactly one doc generated for this case')
    const hasBlanksInDoc = /\[TO BE COMPLETED/.test(result.docs[0].filled)
    check(hasBlanksInDoc, 'sanity: the generated document actually has at least one [TO BE COMPLETED] blank for this profile')
    check(
      result.coverMemo.includes('Blanks still need filling in'),
      "REQUIRED: the cover memo's blanks section appears when the document actually has unfilled fields",
    )
    check(
      result.coverMemo.includes("Founders' Agreement"),
      'the cover memo lists the document by its human label, not its internal template_name',
    )
  }
  // ── REQUIRED (B2): validation (equity sums) runs and surfaces in the
  // cover memo ─────────────────────────────────────────────────────────────
  {
    const badProfile = baseProfile({
      founders: [
        { name: 'Ari Chen', equity_pct: 50, role: 'CEO', commitment: 'full-time' },
        { name: 'Bex Molina', equity_pct: 50, role: 'CTO', commitment: 'full-time' },
        { name: 'Cy Osei', equity_pct: 50, role: 'COO', commitment: 'full-time' },
      ],
      recommended_documents: ["Founders' Agreement"],
    })
    const validation = validateProfile(badProfile)
    check(!validation.valid, 'sanity: a 150% equity split is correctly flagged invalid by validateProfile')
    const result = await generateFounderPack(badProfile)
    check(!result.profileValidation.valid, 'REQUIRED: generateFounderPack surfaces the same invalid equity validation')
    check(
      result.coverMemo.includes('150'),
      'the cover memo surfaces the specific validation error (150%), not just a generic warning',
    )
  }

  // ── buildCoverMemo directly: what's included + what each doc is for,
  // and the "no blanks" branch (proven directly with a filled string that
  // truly has zero [TO BE COMPLETED] markers, rather than relying on a
  // live-generated document that may always carry an unrelated unfilled
  // field regardless of profile completeness) ─────────────────────────────
  {
    const docs: FounderPackDoc[] = [
      { template_name: 'founders_agreement', label: "Founders' Agreement", filled: 'No blanks here.', docx_b64: 'x', docx_name: 'a.docx', pdf_b64: 'x', pdf_name: 'a.pdf' },
    ]
    const memo = buildCoverMemo(baseProfile(), docs, { valid: true, errors: [] })
    check(memo.includes("What's included:"), 'cover memo has a "what\'s included" section')
    check(memo.includes('Locks in your equity split'), "cover memo describes what the Founders' Agreement is for")
    check(memo.includes('Have a licensed attorney review'), 'cover memo includes the standing attorney-review note')
    check(
      memo.includes('No [TO BE COMPLETED] blanks are left'),
      'REQUIRED: the "no blanks" message appears when no document in the pack actually has any blanks',
    )
    check(!memo.includes('Blanks still need filling in'), 'the "blanks remaining" section does NOT appear when there are none')
  }

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
  if (failures > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
