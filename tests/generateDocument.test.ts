// Regression test for lib/generateDocument.ts, extracted out of
// app/api/generate/route.ts (B2 backend note: "reuse the single-document
// generator... one engine, many documents, never a second generation
// path"). Deterministic, no API/network calls — exercises the real
// render/docx/pdf pipeline against actual template files on disk.
import { TEMPLATE_FILES, readTemplateRaw, generateDocument } from '../lib/generateDocument'
import { emptyProfile, type FounderProfile } from '../lib/founderProfile'

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

function realisticProfile(): FounderProfile {
  return {
    ...emptyProfile(),
    company_name: 'Acme Robotics Inc.',
    product_description: 'a marketplace app connecting student robotics teams with mentors',
    business_type: 'product',
    structure: 'Delaware C-Corp',
    state: 'Delaware',
    registered: true,
    handles_user_data: true,
    has_ip: true,
    founders: [
      { name: 'Ari Chen', equity_pct: 50, role: 'CEO', commitment: 'full-time' },
      { name: 'Bex Molina', equity_pct: 50, role: 'CTO', commitment: 'full-time' },
    ],
  }
}

async function main() {
  const templateNames = Object.keys(TEMPLATE_FILES)
  check(templateNames.length === 15, `TEMPLATE_FILES has all 15 templates registered (has ${templateNames.length})`)

  const profile = realisticProfile()

  // ── REQUIRED (B2): the template-leak test passes for every one of the 15
  // types — no {{ }} / {% %} survives, for every template this engine can
  // produce, not just a sample. ─────────────────────────────────────────────
  for (const templateName of templateNames) {
    const result = await generateDocument(templateName, profile)
    const hasLeakedTags = /\{\{|\{%/.test(result.filled)
    check(!hasLeakedTags, `REQUIRED (B2): ${templateName} has no leaked {{ }} / {% %} tags`)
    check(result.docx_b64.length > 0, `${templateName}: docx_b64 is non-empty`)
    check(result.pdf_b64.length > 0, `${templateName}: pdf_b64 is non-empty`)
    check(result.docx_name.endsWith('.docx'), `${templateName}: docx_name has the right extension`)
    check(result.pdf_name.endsWith('.pdf'), `${templateName}: pdf_name has the right extension`)
    check(result.template_name === templateName, `${templateName}: result echoes back the requested template_name`)
  }

  // ── readTemplateRaw / generateDocument error handling ───────────────────
  check(
    (() => {
      try { readTemplateRaw('not_a_real_template'); return false } catch { return true }
    })(),
    'readTemplateRaw throws for an unknown template name',
  )
  let threwForUnknown = false
  try {
    await generateDocument('not_a_real_template', profile)
  } catch {
    threwForUnknown = true
  }
  check(threwForUnknown, 'generateDocument throws for an unknown template name, rather than silently returning something')

  // ── Real values fill in correctly (spot check, mirrors edge-case-runner's
  // EC-04) ─────────────────────────────────────────────────────────────────
  const foundersAgreement = await generateDocument('founders_agreement', profile)
  check(foundersAgreement.filled.includes('Acme Robotics Inc.'), 'founders_agreement fills in the real company name')
  check(foundersAgreement.filled.includes('Ari Chen') && foundersAgreement.filled.includes('Bex Molina'), 'founders_agreement fills in real founder names')

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
  if (failures > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
