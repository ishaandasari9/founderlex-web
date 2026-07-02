import removeConfusables from 'confusables'

// Shared regex-based backstop: catches confident verdicts on legal safety
// that no FounderLex surface should ever make, in either a chat reply or a
// document explanation. Not a substitute for good prompting — a second,
// independent layer in case a jailbreak or unusual phrasing gets past the
// system prompt's instructions. Originally lived only in lib/explainForm.ts;
// extracted here so lib/redFlags.ts can reuse the exact same patterns for
// chat replies rather than re-typing them.
const FORBIDDEN_ASSERTION_PATTERNS: RegExp[] = [
  /you should sign/i,
  /(is|looks|seems|appears)\s+(legally\s+)?(fine|safe|okay|ok)\s+to\s+sign/i,
  /safe\s+(for\s+you\s+)?to\s+sign/i,
  /this\s+is\s+legally\s+(fine|sound|safe|okay|ok)/i,
  /(go ahead|okay|ok|fine|safe)\s+to\s+(sign|proceed)/i,
  /you\s+can\s+(safely\s+)?sign/i,
  /no\s+(need|reason)\s+to\s+(worry|consult|see a lawyer)/i,
  // Paraphrased green-lights that convey the same verdict without matching
  // any pattern above (Codex audit finding). Each is scoped to the
  // signing/document-review context where possible, rather than a bare
  // "don't need a lawyer" — FounderLex legitimately says things like "you
  // don't need a lawyer to get an EIN" as accurate, narrow domain guidance
  // unrelated to signing, and that must stay allowed.
  /\bgreen\s*(light(ed)?|lit)\b/i,
  /(i'?d be|i'?m|i am)\s+comfortable\s+(with\s+you\s+)?signing/i,
  /\bno\s+(attorney|lawyer)\s+review\s+(is\s+)?needed\b/i,
  /\bdon'?t\s+need\s+(a\s+|an\s+)?(attorney|lawyer)\s+(to\s+)?review\b/i,
  /\bskip\s+(the\s+)?(attorney|lawyer)\b/i,
  /you'?re\s+(good|all set|clear)\s+to\s+sign/i,
  /nothing\s+(here\s+)?(should\s+)?stop(s|ping)?\s+you\s+from\s+signing/i,
  // Name/trademark-verdict phrasing (Name & Similar Org Search feature) —
  // the same idea as the sign/document patterns above, but for "use" or
  // "register a name" rather than "sign a document." Scoped tightly around
  // "name" or "trademark"/"register"/"use" specifically, since bare words
  // like "clear," "available," or "conflict" are extremely common in
  // unrelated, legitimate FounderLex content (e.g. "no conflicts of
  // interest" in a nonprofit bylaws discussion) and must not be flagged.
  /\b(this\s+)?name\s+(is|looks|seems|appears)\s+(available|clear|safe|approved)\b/i,
  /\b(is|looks|seems|appears)\s+(available|clear|safe|okay|ok|good|ready)\s+to\s+(use|register|launch)\b/i,
  /\bno\s+(trademark|naming|brand)\s+conflicts?\b/i,
  /\bno\s+conflicts?\s+(with|for)\s+(this|the)?\s*name\b/i,
  /\bfree\s+and\s+clear\b/i,
  /\bfree\s+to\s+(use|register)\s+(this|the)\s+name\b/i,
  /\byou\s+(can|could)\s+(safely\s+)?(use|register)\s+this\s+name\b/i,
  /\bapproved\s+(for|to)\s+(use|register(ation)?)\b/i,
  // Overconfident-outcome language outside the signing/naming context
  // (Codex audit, chat pipeline hardening): "you'll be fine" or "the wall
  // holds up fine" assert a guaranteed legal outcome (e.g. that an LLC's
  // liability shield will hold up) with no actual determination behind it —
  // the same category of overclaim as the signing-verdict patterns above,
  // just not phrased around "sign." Apostrophe made optional/curly-aware
  // since chat output isn't guaranteed to use a straight ASCII apostrophe.
  /\byou(?:'ll|’ll|\s+will)\s+be\s+(?:totally\s+|completely\s+)?fine\b/i,
  /\bholds?\s+up\s+(?:just\s+)?fine\b/i,
  // "you're protected" / "you're fully covered" (Codex audit, AC-10):
  // the same overconfident-outcome category as "you'll be fine" above —
  // asserts a guaranteed legal/liability outcome with no actual
  // determination behind it. Apostrophe optional/curly-aware for the same
  // reason as the pattern above.
  /\byou(?:'re|’re|\s+are)\s+(?:fully\s+|completely\s+)?(?:protected|covered)\b/i,
]

// A phrase split by markdown emphasis ("you can **safely** sign") or by
// punctuation ("you can, safely, sign") breaks the \s+ literal-adjacency
// patterns above, letting a forbidden phrase through undetected in raw form
// even though it reads identically to a person once rendered/spoken. Strip
// markdown markers entirely and collapse punctuation into whitespace before
// testing, so word adjacency for detection purposes matches what a reader
// actually sees, regardless of what formatting or punctuation sits between
// the words.
//
// Confusables/homoglyphs (Cyrillic "р" in "you're рrotected," etc.) used to
// be folded by a hand-maintained CONFUSABLES map covering a handful of
// Cyrillic/Greek characters (Codex audit finding: it was missing Cyrillic
// "р" -> "p," among others, and a hand-picked list can never be complete).
// Replaced with the `confusables` package's remove(), which implements
// proper Unicode confusables/skeleton normalization across the full Latin
// alphabet (Cyrillic, Greek, full-width, mathematical alphanumeric, and
// more) instead of a per-character list that has to be hand-extended every
// time a new bypass character is found — closing this whole class of
// bypass permanently rather than one phrase/character at a time.
function normalizeForDetection(text: string): string {
  return removeConfusables(text)
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[*_`#]+/g, '')
    .replace(/[,;:—–-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function containsForbiddenAssertion(text: string): boolean {
  const normalized = normalizeForDetection(text)
  return FORBIDDEN_ASSERTION_PATTERNS.some((p) => p.test(normalized))
}
