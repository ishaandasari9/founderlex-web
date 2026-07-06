// Deterministic test for lib/metaQuestion.ts (meta-question refusal fix).
// No API calls. Confirms the detector fires on clear product/capability/
// pricing/identity questions about FounderLex (which must always be answered,
// never refused), and does NOT fire on substantive legal questions that must
// still go through the grounded + verified pipeline.
import { isMetaProductQuestion } from '../lib/metaQuestion'

let checks = 0
let failures = 0

function expect(message: string, actual: boolean, wanted: boolean) {
  checks++
  if (actual === wanted) {
    console.log(`PASS  ${message}`)
  } else {
    console.log(`FAIL  ${message} (got ${actual}, wanted ${wanted})`)
    failures++
  }
}

// ── Must be treated as meta (skip verifier, always answer) ───────────────────
const META: string[] = [
  'what can you do?',
  'what can you do',
  'what do you make?',
  'what do you draft?',
  'what documents do you make?',
  'what docs do you draft?',
  'what kinds of documents do you make?',
  'how many documents do you draft?',
  'which templates do you offer?',
  'what can you help with?',
  'how can you help me?',
  'what are you?',
  'who are you?',
  'what is founderlex?',
  "what's founderlex?",
  'how does this work?',
  'how do you work?',
  'are you free?',
  'is this free?',
  'is founderlex free?',
  'is it free to use?',
  'how much do you cost?',
  'is there a fee?',
  'are you a lawyer?',
  'are you a real lawyer?',
  'are you an AI?',
  'who made you?',
]
for (const q of META) expect(`META  "${q}"`, isMetaProductQuestion(q), true)

// ── Must NOT be treated as meta (still grounded + verified) ──────────────────
const NOT_META: string[] = [
  'what documents do I need to hire a contractor?',
  'what documents do I need for my LLC?',
  'how do I form an LLC?',
  'can you draft me a founders agreement?',
  'is my LLC liability shield going to protect me?',
  'is getting an EIN free, and where do you get one?',
  'what clause makes sure my company owns the work a contractor produces?',
  'do I need a conflict of interest policy for my nonprofit board?',
  'which annual IRS return does a small nonprofit with gross receipts under $50,000 file?',
  // Meta-ish phrase but too long / carries a real legal ask -> let it verify.
  'are you free to help me respond to a lawsuit and figure out whether I should countersue my old cofounder?',
]
for (const q of NOT_META) expect(`NOT   "${q}"`, isMetaProductQuestion(q), false)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
