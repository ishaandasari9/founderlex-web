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
]

// A phrase split by markdown emphasis ("you can **safely** sign") or by
// punctuation ("you can, safely, sign") breaks the \s+ literal-adjacency
// patterns above, letting a forbidden phrase through undetected in raw form
// even though it reads identically to a person once rendered/spoken. Strip
// markdown markers entirely and collapse punctuation into whitespace before
// testing, so word adjacency for detection purposes matches what a reader
// actually sees, regardless of what formatting or punctuation sits between
// the words.
function normalizeForDetection(text: string): string {
  return text
    .replace(/[*_`#]+/g, '')
    .replace(/[,;:—–-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

export function containsForbiddenAssertion(text: string): boolean {
  const normalized = normalizeForDetection(text)
  return FORBIDDEN_ASSERTION_PATTERNS.some((p) => p.test(normalized))
}
